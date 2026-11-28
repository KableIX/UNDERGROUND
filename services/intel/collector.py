"""UNDERGROUND INTEL shadow collector.

Official sources only: Caltrans CWWP2 LCS (D4, D5), NWS alerts (CA, FL), 511 SF Bay
Open511 traffic events (CHP, Caltrans and local agencies via 511.org).
SHADOW MODE: nothing is published. Every normalized row has published=0.
The 511 API key is read at runtime from ~/.config/underground-intel/511.token and is
never logged or stored: URLs written to the DB are key-free and all text is scrubbed.
"""
import gzip, json, logging, math, os, re, sqlite3, stat, sys, time, urllib.error, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).parent
DB_PATH = ROOT / 'shadow.sqlite3'
TOKEN_PATH = Path(os.environ.get('INTEL_511_TOKEN_FILE', Path.home() / '.config/underground-intel/511.token'))
PUBLISH = False  # shadow mode; do not change until correlation + publication validation exist
INTERVAL = 300
UA = 'UNDERGROUND-INTEL/0.2 (road condition research)'
MAX_BYTES = 25_000_000

SOURCES = {**{f'caltrans-d{d}': f'https://cwwp2.dot.ca.gov/data/d{d}/lcs/lcsStatusD{d:02}.json' for d in (4, 5)},
           **{f'nws-{s}': f'https://api.weather.gov/alerts/active?area={s}' for s in ('CA', 'FL')}}
# 511: one call per cycle (all active events fit in one page with limit=500).
S511 = '511-bayarea'
URL_511 = 'https://api.511.org/traffic/events'
PARAMS_511 = {'format': 'json', 'status': 'ACTIVE', 'limit': '500'}
PUBLIC_URL_511 = URL_511 + '?' + urllib.parse.urlencode(PARAMS_511)  # key-free, safe to store
LIMIT_511_PER_HOUR = 30      # 511 allows 60 / 3600 s per key; we self-cap at half
MIN_REMAINING_511 = 5        # back off if provider says we are near its limit

DEDUP_RADIUS_M = 1000.0
RETENTION_S = 14 * 86400
RAW_RETENTION_S = 7 * 86400
STALE_GRACE_S = 900          # open-ended items expire if not re-seen within 15 min

# ---------------------------------------------------------------- secrets / redaction
_SECRETS = set()

def load_token(path=TOKEN_PATH):
    try:
        st = path.stat()
    except FileNotFoundError:
        return None
    if st.st_mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise PermissionError('511 token file must be mode 600')
    tok = re.sub(r'\s', '', path.read_text())
    if tok:
        _SECRETS.add(tok)
    return tok or None

_KEY_RE = re.compile(r'(api_key=)[^&\s"\']+', re.I)

def redact(text):
    text = _KEY_RE.sub(r'\1[REDACTED]', str(text))
    for s in _SECRETS:
        text = text.replace(s, '[REDACTED]')
    return text

class RedactFilter(logging.Filter):
    def filter(self, record):
        record.msg = redact(record.getMessage()); record.args = ()
        return True

def safe_error(e):
    code = getattr(e, 'code', None)
    return redact(f'{type(e).__name__}' + (f' {code}' if code else ''))

# ---------------------------------------------------------------- HTTP with retries
class Permanent(Exception):
    pass

def http_get(url, accept, retries=3, timeout=25, gzip_ok=False):
    headers = {'User-Agent': UA, 'Accept': accept}
    if gzip_ok:
        headers['Accept-Encoding'] = 'gzip'
    last = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as r:
                raw = r.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise Permanent('response too large')
                if r.headers.get('Content-Encoding') == 'gzip':
                    raw = gzip.decompress(raw)
                return raw, r.status, dict(r.headers), attempt
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (400, 401, 403, 404, 406) or e.code == 429:
                raise Permanent(f'HTTP {e.code}') from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            last = e
        if attempt < retries:
            time.sleep(2 ** attempt)
    raise Permanent(safe_error(last)) from None

# ---------------------------------------------------------------- time / geo helpers
def parse_ts(s):
    if not s:
        return None
    s = s.strip().replace('Z', '+00:00')
    for fmt in ('%Y-%m-%dT%H:%M%z', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%dT%H:%M:%S.%f%z'):
        try:
            return int(datetime.strptime(s, fmt).timestamp())
        except ValueError:
            pass
    return None

def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ') if ts else None

def haversine(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))

def point_segment_m(lat, lon, a, b):
    """Approx distance (m) from point to segment a-b (lat,lon) using local equirectangular."""
    k = math.cos(math.radians(lat))
    ax, ay = (a[1] - lon) * k, a[0] - lat
    bx, by = (b[1] - lon) * k, b[0] - lat
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / (dx * dx + dy * dy)))
    px, py = ax + t * dx, ay + t * dy
    return math.hypot(px, py) * 111_320.0

CA_BOUNDS = (32.3, 42.1, -124.6, -114.0)

def geo_valid(lat, lon, bounds=CA_BOUNDS):
    return lat is not None and lon is not None and bounds[0] <= lat <= bounds[1] and bounds[2] <= lon <= bounds[3]

def norm_road(name):
    """'CA-128 E' / 'SR-128' -> 'SR-128'; 'I-80 W' -> 'I-80'; 'US-101 N' -> 'US-101'. Else None."""
    if not name:
        return None
    m = re.match(r'\s*(CA|SR|I|US)[-\s]?(\d+)\b', name.upper())
    if not m:
        return None
    pre = {'CA': 'SR'}.get(m.group(1), m.group(1))
    return f'{pre}-{int(m.group(2))}'

# ---------------------------------------------------------------- normalization
def category_511(ev):
    subs = ' '.join(ev.get('event_subtypes') or []).lower()
    states = {(r.get('state') or '').upper() for r in ev.get('roads') or []}
    if 'CLOSED' in states or 'ALL_LANES_CLOSED' in states:
        return 'closure'
    if re.search(r'collision|crash|overturn|accident', subs): return 'accident'
    if re.search(r'debris|hazard|object|spill|animal|pothole', subs): return 'debris_hazard'
    if 'fire' in subs: return 'fire'
    if re.search(r'fog|wind|flood|snow|ice|rain|chain|weather', subs) or ev.get('event_type') == 'WEATHER_CONDITION':
        return 'weather'
    if re.search(r'disabled|stall', subs): return 'disabled_vehicle'
    t = ev.get('event_type')
    return {'CONSTRUCTION': 'construction', 'SPECIAL_EVENT': 'special_event',
            'ROAD_CONDITION': 'road_condition', 'INCIDENT': 'incident'}.get(t, 'other')

def normalize_511(payload, now):
    out = []
    for ev in payload.get('events') or []:
        eid = ev.get('id')
        if not eid:
            continue
        geom = ev.get('geography') or {}
        coords = geom.get('coordinates')
        lat = lon = None
        if geom.get('type') == 'Point' and coords and len(coords) >= 2:
            lon, lat = float(coords[0]), float(coords[1])
        elif geom.get('type') in ('LineString', 'MultiPoint') and coords:
            lon, lat = float(coords[0][0]), float(coords[0][1])
        elif geom.get('type') == 'MultiLineString' and coords and coords[0]:
            lon, lat = float(coords[0][0][0]), float(coords[0][0][1])
        road = (ev.get('roads') or [{}])[0]
        starts = ends = None
        for iv in (ev.get('schedule') or {}).get('intervals') or []:
            a, _, b = iv.partition('/')
            sa, sb = parse_ts(a), parse_ts(b)
            starts = sa if starts is None or (sa and sa < starts) else starts
            if sb: ends = sb if ends is None or sb > ends else ends
        expires, basis = (ends, 'provider_schedule') if ends else (now + STALE_GRACE_S, 'rolling_unseen_15min')
        out.append(dict(
            source=S511, source_id=eid, event_type=ev.get('event_type'), category=category_511(ev),
            subtypes=json.dumps(ev.get('event_subtypes') or []), severity=ev.get('severity'),
            status=ev.get('status'), headline=ev.get('headline'), road_name=road.get('name'),
            road_key=norm_road(road.get('name')), direction=road.get('direction'), road_state=road.get('state'),
            lat=lat, lon=lon, end_lat=None, end_lon=None, geometry=json.dumps(geom) if geom else None,
            geo_valid=int(geo_valid(lat, lon)), starts_at=starts, ends_at=ends,
            created_at=parse_ts(ev.get('created')), updated_at=parse_ts(ev.get('updated')),
            expires_at=expires, expiry_basis=basis,
            attribution=f"511 SF Bay (511.org); originator: {ev.get('+source_type') or 'unknown'}",
            upstream=ev.get('+source_type'), upstream_id=ev.get('+source_id'),
            raw=json.dumps(ev)))
    return out

def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None

def normalize_lcs(source, payload, now):
    out = []
    for item in payload.get('data') or []:
        l = item.get('lcs') or {}
        loc, c = l.get('location') or {}, l.get('closure') or {}
        b, e = loc.get('begin') or {}, loc.get('end') or {}
        ts = c.get('closureTimestamp') or {}
        if not l.get('index'):
            continue
        starts = int(ts['closureStartEpoch']) if (ts.get('closureStartEpoch') or '').isdigit() else None
        ends = int(ts['closureEndEpoch']) if (ts.get('closureEndEpoch') or '').isdigit() else None
        if ts.get('isClosureEndIndefinite') == 'true':
            ends = None
        lifted = (c.get('code1098') or {}).get('isCode1098') == 'true'
        in_place = (c.get('code1097') or {}).get('isCode1097') == 'true'
        typ = c.get('typeOfClosure') or ''
        lat, lon = _f(b.get('beginLatitude')), _f(b.get('beginLongitude'))
        out.append(dict(
            source=source, source_id=l['index'], event_type='LANE_CLOSURE',
            category='closure' if typ.lower().startswith('full') else 'construction',
            subtypes=json.dumps([x for x in (typ, c.get('typeOfWork')) if x]), severity=None,
            status='LIFTED' if lifted else ('IN_PLACE' if in_place else 'SCHEDULED'),
            headline=f"{b.get('beginRoute', '')} {typ} {c.get('typeOfWork', '')} {b.get('beginLocationName', '')} to {e.get('endLocationName', '')}".strip(),
            road_name=b.get('beginRoute'), road_key=norm_road(b.get('beginRoute')),
            direction=loc.get('travelFlowDirection'), road_state=f"{c.get('lanesClosed')}/{c.get('totalExistingLanes')} lanes",
            lat=lat, lon=lon, end_lat=_f(e.get('endLatitude')), end_lon=_f(e.get('endLongitude')),
            geometry=None, geo_valid=int(geo_valid(lat, lon)), starts_at=starts, ends_at=ends,
            created_at=int(ts['closureRequestEpoch']) if (ts.get('closureRequestEpoch') or '').isdigit() else None,
            updated_at=int((l.get('recordTimestamp') or {}).get('recordEpoch') or 0) or None,
            expires_at=ends if ends else now + STALE_GRACE_S,
            expiry_basis='provider_schedule' if ends else 'rolling_unseen_15min',
            attribution=f'Caltrans CWWP2 Lane Closure System ({source})', upstream='Caltrans', upstream_id=c.get('closureID'),
            raw=json.dumps(item)))
    return out

# ---------------------------------------------------------------- dedup
def overlaps(a_start, a_end, b_start, b_end, now):
    a0, a1 = a_start or now, a_end or now + STALE_GRACE_S
    b0, b1 = b_start or now, b_end or now + STALE_GRACE_S
    return a0 <= b1 and b0 <= a1

def find_duplicates(rows_511, rows_ct, now, radius=DEDUP_RADIUS_M):
    """Same road + within radius of the Caltrans begin-end segment + overlapping time."""
    by_road = {}
    for r in rows_ct:
        if r['road_key'] and r['geo_valid'] and r['status'] != 'LIFTED':
            by_road.setdefault(r['road_key'], []).append(r)
    links = []
    for a in rows_511:
        if not (a['road_key'] and a['geo_valid']):
            continue
        for b in by_road.get(a['road_key'], ()):
            end = (b['end_lat'], b['end_lon']) if b['end_lat'] is not None and b['end_lon'] is not None else (b['lat'], b['lon'])
            d = point_segment_m(a['lat'], a['lon'], (b['lat'], b['lon']), end)
            if d <= radius and overlaps(a['starts_at'], a['ends_at'], b['starts_at'], b['ends_at'], now):
                links.append((a['source'], a['source_id'], b['source'], b['source_id'], round(d, 1)))
    return links

# ---------------------------------------------------------------- DB
SCHEMA = '''
CREATE TABLE IF NOT EXISTS snapshots (source TEXT PRIMARY KEY,url TEXT NOT NULL,fetched_at INTEGER NOT NULL,payload TEXT NOT NULL,record_count INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS health (source TEXT PRIMARY KEY,checked_at INTEGER NOT NULL,ok INTEGER NOT NULL,detail TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS source_health (source TEXT PRIMARY KEY, state TEXT NOT NULL, checked_at INTEGER NOT NULL,
  last_success_at INTEGER, consecutive_failures INTEGER NOT NULL DEFAULT 0, last_error TEXT, last_records INTEGER,
  last_latency_ms INTEGER, rate_remaining INTEGER);
CREATE TABLE IF NOT EXISTS ingest_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_at INTEGER NOT NULL, source TEXT NOT NULL,
  ok INTEGER NOT NULL, state TEXT NOT NULL, http_status INTEGER, attempts INTEGER, latency_ms INTEGER, records INTEGER,
  normalized INTEGER, inserted INTEGER, updated INTEGER, expired INTEGER, duplicates INTEGER, by_category TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS request_log (source TEXT NOT NULL, requested_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS request_log_idx ON request_log(source, requested_at);
CREATE TABLE IF NOT EXISTS incidents (source TEXT NOT NULL, source_id TEXT NOT NULL, event_type TEXT, category TEXT, subtypes TEXT,
  severity TEXT, status TEXT, headline TEXT, road_name TEXT, road_key TEXT, direction TEXT, road_state TEXT,
  lat REAL, lon REAL, end_lat REAL, end_lon REAL, geometry TEXT, geo_valid INTEGER NOT NULL DEFAULT 0,
  starts_at INTEGER, ends_at INTEGER, created_at INTEGER, updated_at INTEGER, expires_at INTEGER, expiry_basis TEXT,
  attribution TEXT NOT NULL, upstream TEXT, upstream_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified_official', published INTEGER NOT NULL DEFAULT 0 CHECK (published = 0),
  active INTEGER NOT NULL DEFAULT 1, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL, withdrawn_at INTEGER,
  duplicate_of TEXT, raw TEXT NOT NULL, PRIMARY KEY (source, source_id));
CREATE INDEX IF NOT EXISTS incidents_road ON incidents(road_key, active);
CREATE TABLE IF NOT EXISTS duplicate_links (source_a TEXT NOT NULL, id_a TEXT NOT NULL, source_b TEXT NOT NULL, id_b TEXT NOT NULL,
  distance_m REAL, method TEXT NOT NULL, first_linked INTEGER NOT NULL, last_confirmed INTEGER NOT NULL,
  PRIMARY KEY (source_a, id_a, source_b, id_b));
'''

COLS = ['source', 'source_id', 'event_type', 'category', 'subtypes', 'severity', 'status', 'headline', 'road_name', 'road_key',
        'direction', 'road_state', 'lat', 'lon', 'end_lat', 'end_lon', 'geometry', 'geo_valid', 'starts_at', 'ends_at',
        'created_at', 'updated_at', 'expires_at', 'expiry_basis', 'attribution', 'upstream', 'upstream_id', 'raw']

def init_db(db):
    db.executescript(SCHEMA)

def upsert_incidents(db, source, rows, now):
    existing = {r[0]: (r[1], r[2]) for r in db.execute(
        'SELECT source_id,active,withdrawn_at FROM incidents WHERE source=?', (source,))}
    ins = upd = expired = 0
    for r in rows:
        sid = r['source_id']
        # Ended/lifted records may remain in a provider snapshot for several cycles.
        active = int(r['status'] not in ('LIFTED', 'INACTIVE', 'CANCELLED', 'CLOSED_EVENT')
                     and (r['expires_at'] is None or r['expires_at'] > now))
        prior = existing.get(sid)
        withdrawn = None if active else (prior[1] if prior and not prior[0] and prior[1] is not None else now)
        vals = [r[c] for c in COLS]
        if prior is not None:
            if prior[0] and not active:
                expired += 1
            sets = ','.join(f'{c}=?' for c in COLS[2:])
            db.execute(f'UPDATE incidents SET {sets},active=?,withdrawn_at=?,last_seen=? WHERE source=? AND source_id=?',
                       vals[2:] + [active, withdrawn, now, source, sid])
            upd += 1
        else:
            db.execute(f'INSERT INTO incidents ({",".join(COLS)},first_seen,last_seen,active,withdrawn_at) VALUES ({",".join("?" * len(COLS))},?,?,?,?)',
                       vals + [now, now, active, withdrawn])
            ins += 1
        existing[sid] = (active, withdrawn)
    seen = {r['source_id'] for r in rows}
    for sid in existing.keys() - seen:
        expired += db.execute('UPDATE incidents SET active=0, withdrawn_at=? WHERE source=? AND source_id=? AND active=1',
                              (now, source, sid)).rowcount
    return ins, upd, expired

def cleanup(db, now):
    """Retain current source snapshots, active events, and short-lived audit evidence.
    Keep lightweight tombstones for ended events still present in a feed so they
    cannot be counted as fresh expirations. Purge unseen inactive records after 14 days.
    """
    db.execute('UPDATE incidents SET active=0,withdrawn_at=COALESCE(withdrawn_at,?) WHERE active=1 AND expires_at IS NOT NULL AND expires_at<=?', (now,now))
    db.execute("UPDATE incidents SET raw='{}' WHERE active=0 AND withdrawn_at<=? AND raw!='{}'", (now-RAW_RETENTION_S,))
    removed=db.execute('DELETE FROM incidents WHERE active=0 AND last_seen<?', (now-RETENTION_S,)).rowcount
    db.execute('DELETE FROM duplicate_links WHERE last_confirmed<? OR NOT EXISTS (SELECT 1 FROM incidents WHERE source=source_a AND source_id=id_a) OR NOT EXISTS (SELECT 1 FROM incidents WHERE source=source_b AND source_id=id_b)', (now-RETENTION_S,))
    db.execute('DELETE FROM ingest_stats WHERE cycle_at<?', (now-RETENTION_S,))
    db.execute('DELETE FROM request_log WHERE requested_at<?', (now-86400,))
    db.execute('DELETE FROM snapshots WHERE fetched_at<?', (now-86400,))
    return removed

def record_links(db, links, now):
    for sa, ia, sb, ib, d in links:
        db.execute('''INSERT INTO duplicate_links VALUES (?,?,?,?,?,?,?,?)
            ON CONFLICT(source_a,id_a,source_b,id_b) DO UPDATE SET distance_m=excluded.distance_m,last_confirmed=excluded.last_confirmed''',
                   (sa, ia, sb, ib, d, 'same_road+segment<=1km+time_overlap', now, now))
        db.execute('UPDATE incidents SET duplicate_of=? WHERE source=? AND source_id=?', (f'{sb}:{ib}', sa, ia))

def rate_ok(db, source, now, limit=LIMIT_511_PER_HOUR):
    db.execute('DELETE FROM request_log WHERE requested_at<?', (now - 86400,))
    n = db.execute('SELECT COUNT(*) FROM request_log WHERE source=? AND requested_at>?', (source, now - 3600)).fetchone()[0]
    row = db.execute('SELECT rate_remaining, checked_at FROM source_health WHERE source=?', (source,)).fetchone()
    if row and row[0] is not None and row[0] < MIN_REMAINING_511 and now - row[1] < 3600:
        return False
    return n < limit

def set_health(db, source, now, ok, state, records=None, error=None, latency=None, remaining=None):
    db.execute('INSERT OR REPLACE INTO health VALUES (?,?,?,?)', (source, now, int(ok), str(records) if ok else (error or state)))
    db.execute('''INSERT INTO source_health(source,state,checked_at,last_success_at,consecutive_failures,last_error,last_records,last_latency_ms,rate_remaining)
        VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(source) DO UPDATE SET state=excluded.state, checked_at=excluded.checked_at,
        last_success_at=COALESCE(excluded.last_success_at, source_health.last_success_at),
        consecutive_failures=CASE WHEN ? THEN 0 ELSE source_health.consecutive_failures+1 END,
        last_error=excluded.last_error, last_records=COALESCE(excluded.last_records, source_health.last_records),
        last_latency_ms=excluded.last_latency_ms, rate_remaining=COALESCE(excluded.rate_remaining, source_health.rate_remaining)''',
               (source, state, now, now if ok else None, 0 if ok else 1, None if ok else error, records, latency, remaining, int(ok)))

# ---------------------------------------------------------------- fetchers
def fetch_public(name, url):
    t0 = time.time()
    raw, status, _, attempts = http_get(url, 'application/geo+json, application/json')
    data = json.loads(raw)
    key = 'data' if name.startswith('caltrans') else 'features'
    if not isinstance(data.get(key), list):
        raise Permanent('unexpected schema')
    return dict(url=url, data=data, n=len(data[key]), status=status, attempts=attempts, ms=int((time.time() - t0) * 1000), remaining=None)

def fetch_511(token):
    t0 = time.time()
    q = dict(PARAMS_511, api_key=token)
    raw, status, headers, attempts = http_get(URL_511 + '?' + urllib.parse.urlencode(q), 'application/json', gzip_ok=True)
    data = json.loads(redact(raw.decode('utf-8-sig')))  # 511 echoes the key in meta/pagination URLs: scrub before use
    if not isinstance(data.get('events'), list):
        raise Permanent('unexpected schema')
    rem = headers.get('RateLimit-Remaining')
    return dict(url=PUBLIC_URL_511, data=data, n=len(data['events']), status=status, attempts=attempts,
                ms=int((time.time() - t0) * 1000), remaining=int(rem) if (rem or '').isdigit() else None)

# ---------------------------------------------------------------- cycle
def cycle(db_path=DB_PATH):
    now = int(time.time())
    with sqlite3.connect(db_path, timeout=30) as db:
        init_db(db)
        try:
            token = load_token()
        except PermissionError as e:
            token, tok_err = None, str(e)
        else:
            tok_err = None if token else 'token file missing'
        jobs = {}
        with ThreadPoolExecutor(max_workers=5) as pool:
            for name, url in SOURCES.items():
                jobs[name] = pool.submit(fetch_public, name, url)
            if token and rate_ok(db, S511, now):
                db.execute('INSERT INTO request_log VALUES (?,?)', (S511, now))
                jobs[S511] = pool.submit(fetch_511, token)
            results = {}
            for name, job in jobs.items():
                try:
                    results[name] = job.result()
                except Exception as e:
                    results[name] = e
        if S511 not in jobs:
            state = 'BLOCKED' if tok_err else 'RATE_LIMITED_SELF'
            set_health(db, S511, now, False, state, error=tok_err or 'skipped: self-imposed hourly cap')
            db.execute('INSERT INTO ingest_stats(cycle_at,source,ok,state,error) VALUES (?,?,?,?,?)', (now, S511, 0, state, tok_err))
            logging.warning('%s %s', S511, state)
        if S511 in results:  # account for retries against the hourly budget (worst case 3 on failure)
            extra = (results[S511]['attempts'] if isinstance(results[S511], dict) else 3) - 1
            db.executemany('INSERT INTO request_log VALUES (?,?)', [(S511, now)] * extra)
        normalized = {}
        for name, res in results.items():
            if isinstance(res, Exception):
                err = safe_error(res) if not isinstance(res, Permanent) else redact(str(res))
                set_health(db, name, now, False, 'FAILED', error=err)
                db.execute('INSERT INTO ingest_stats(cycle_at,source,ok,state,error) VALUES (?,?,?,?,?)', (now, name, 0, 'FAILED', err))
                logging.warning('%s failure %s', name, err)
                continue
            payload = redact(json.dumps(res['data']))
            db.execute('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?,?)', (name, res['url'], now, payload, res['n']))
            rows = normalize_511(res['data'], now) if name == S511 else (
                normalize_lcs(name, res['data'], now) if name.startswith('caltrans') else None)
            ins = upd = exp = 0
            cats = {}
            if rows is not None:
                ins, upd, exp = upsert_incidents(db, name, rows, now)
                normalized[name] = rows
                for r in rows:
                    cats[r['category']] = cats.get(r['category'], 0) + 1
            set_health(db, name, now, True, 'OK', records=res['n'], latency=res['ms'], remaining=res['remaining'])
            db.execute('''INSERT INTO ingest_stats(cycle_at,source,ok,state,http_status,attempts,latency_ms,records,normalized,inserted,updated,expired,by_category)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''', (now, name, 1, 'OK', res['status'], res['attempts'], res['ms'], res['n'],
                                                      len(rows) if rows is not None else None, ins, upd, exp, json.dumps(cats, sort_keys=True)))
            logging.info('%s records=%s normalized=%s new=%s updated=%s expired=%s %s', name, res['n'],
                         len(rows) if rows is not None else '-', ins, upd, exp, json.dumps(cats, sort_keys=True) if cats else '')
        if S511 in normalized:
            ct = [r for k, v in normalized.items() if k.startswith('caltrans') for r in v]
            if not ct:  # fall back to last known active Caltrans rows
                cur = db.execute("SELECT * FROM incidents WHERE source LIKE 'caltrans-%' AND active=1")
                names = [d[0] for d in cur.description]
                ct = [dict(zip(names, r)) for r in cur]
            db.execute('UPDATE incidents SET duplicate_of=NULL WHERE source=?', (S511,))
            links = find_duplicates(normalized[S511], ct, now)
            record_links(db, links, now)
            db.execute('UPDATE ingest_stats SET duplicates=? WHERE id=(SELECT MAX(id) FROM ingest_stats WHERE source=? AND cycle_at=?)',
                       (len({(l[0], l[1]) for l in links}), S511, now))
            logging.info('%s dedup: %s events linked to Caltrans LCS (%s links)', S511, len({(l[0], l[1]) for l in links}), len(links))
        assert not PUBLISH
        removed = cleanup(db, now)
        if removed:
            logging.info("retention: %s inactive incidents removed", removed)
        db.commit()

def setup_logging():
    logging.basicConfig(level=logging.INFO)
    for h in logging.getLogger().handlers:
        h.addFilter(RedactFilter())
    logging.getLogger('urllib3').setLevel(logging.WARNING)

if __name__ == '__main__':
    setup_logging()
    while True:
        try:
            cycle()
        except Exception as e:  # never die on one bad cycle; never print secrets
            logging.error('cycle failed: %s', safe_error(e))
        if '--once' in sys.argv:
            break
        time.sleep(INTERVAL)
