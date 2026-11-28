"""Offline tests for the 511 adapter: normalization, dedup, redaction, full shadow cycle.
Run: python3 -m unittest discover -s tests -v   (from services/intel)"""
import io, json, logging, os, sqlite3, sys, tempfile, time, unittest
from pathlib import Path
HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
import collector as C

FIX = json.loads((HERE / 'fixture_511_events.json').read_text())
NOW = int(time.time())
FAKE = 'deadbeef-0000-4000-8000-feedfacecafe'

def i80_event():
    return next(e for e in FIX['events'] if e['roads'][0]['name'].startswith('I-80') and e['event_type'] == 'INCIDENT')

def lcs_payload(lat, lon, route='I-80', start=None, end=None, lifted=False):
    return {'data': [{'lcs': {
        'index': 'TEST-0001', 'recordTimestamp': {'recordEpoch': str(NOW)},
        'location': {'travelFlowDirection': 'East',
                     'begin': {'beginRoute': route, 'beginLatitude': str(lat), 'beginLongitude': str(lon), 'beginLocationName': 'A'},
                     'end': {'endLatitude': str(lat + 0.004), 'endLongitude': str(lon + 0.004), 'endLocationName': 'B'}},
        'closure': {'closureID': 'X1', 'typeOfClosure': 'Lane', 'typeOfWork': 'Test',
                    'closureTimestamp': {'closureStartEpoch': str(start or NOW - 3600), 'closureEndEpoch': str(end or NOW + 3600),
                                         'closureRequestEpoch': str(NOW - 86400), 'isClosureEndIndefinite': 'false'},
                    'lanesClosed': '1', 'totalExistingLanes': '4',
                    'code1097': {'isCode1097': 'true'}, 'code1098': {'isCode1098': 'true' if lifted else 'false'}}}}]}

class Normalize(unittest.TestCase):
    def test_all_events_normalized(self):
        rows = C.normalize_511(FIX, NOW)
        self.assertEqual(len(rows), len(FIX['events']))
        for r in rows:
            self.assertEqual(r['source'], '511-bayarea')
            self.assertTrue(r['attribution'].startswith('511 SF Bay'))
            self.assertIsNotNone(r['lat']); self.assertIsNotNone(r['lon'])
            self.assertTrue(r['geo_valid'])
            self.assertIsNotNone(r['expires_at'])
            self.assertIn(r['expiry_basis'], ('provider_schedule', 'rolling_unseen_15min'))
            self.assertIsNotNone(r['starts_at'])

    def test_categories(self):
        cats = {json.loads(r['subtypes'])[0]: r['category'] for r in C.normalize_511(FIX, NOW)}
        self.assertEqual(cats['Traffic Collision'], 'accident')
        self.assertEqual(cats['Traffic Hazard'], 'debris_hazard')
        self.assertEqual(cats['Long-term construction'], 'construction')
        self.assertEqual(cats['Fog'], 'weather')
        self.assertEqual(cats['Disabled vehicle'], 'disabled_vehicle')

    def test_closure_state_wins(self):
        ev = json.loads(json.dumps(i80_event())); ev['roads'][0]['state'] = 'CLOSED'
        self.assertEqual(C.category_511(ev), 'closure')

    def test_open_ended_gets_rolling_expiry(self):
        r = next(r for r in C.normalize_511(FIX, NOW) if r['ends_at'] is None)
        self.assertEqual(r['expires_at'], NOW + C.STALE_GRACE_S)

    def test_timestamps_and_roads(self):
        self.assertEqual(C.parse_ts('2026-11-27T21:31Z'), 1795815060)
        self.assertEqual(C.norm_road('CA-128 E'), 'SR-128')
        self.assertEqual(C.norm_road('SR-1'), 'SR-1')
        self.assertEqual(C.norm_road('US-101 N'), 'US-101')
        self.assertIsNone(C.norm_road('SAP Center'))

    def test_bad_coordinates_flagged_not_dropped(self):
        ev = json.loads(json.dumps(i80_event())); ev['geography']['coordinates'] = [0, 0]
        r = C.normalize_511({'events': [ev]}, NOW)[0]
        self.assertEqual(r['geo_valid'], 0)

class Dedup(unittest.TestCase):
    def setUp(self):
        self.a = [r for r in C.normalize_511(FIX, NOW) if r['source_id'] == i80_event()['id']]
        self.lat, self.lon = self.a[0]['lat'], self.a[0]['lon']

    def test_links_same_road_nearby_overlapping(self):
        ct = C.normalize_lcs('caltrans-d4', lcs_payload(self.lat + 0.002, self.lon), NOW)
        links = C.find_duplicates(self.a, ct, NOW)
        self.assertEqual(len(links), 1)
        self.assertLess(links[0][4], 1000)

    def test_no_link_different_road(self):
        ct = C.normalize_lcs('caltrans-d4', lcs_payload(self.lat, self.lon, route='I-580'), NOW)
        self.assertEqual(C.find_duplicates(self.a, ct, NOW), [])

    def test_no_link_far(self):
        ct = C.normalize_lcs('caltrans-d4', lcs_payload(self.lat + 0.1, self.lon), NOW)
        self.assertEqual(C.find_duplicates(self.a, ct, NOW), [])

    def test_no_link_time_disjoint(self):
        ct = C.normalize_lcs('caltrans-d4', lcs_payload(self.lat, self.lon, start=NOW + 86400 * 30, end=NOW + 86400 * 31), NOW)
        self.assertEqual(C.find_duplicates(self.a, ct, NOW), [])

    def test_no_link_lifted(self):
        ct = C.normalize_lcs('caltrans-d4', lcs_payload(self.lat, self.lon, lifted=True), NOW)
        self.assertEqual(C.find_duplicates(self.a, ct, NOW), [])

class Redaction(unittest.TestCase):
    def setUp(self):
        C._SECRETS.add(FAKE)

    def test_redact_url_and_literal(self):
        s = C.redact(f'https://api.511.org/traffic/events?api_key={FAKE}&format=json also {FAKE}')
        self.assertNotIn(FAKE, s); self.assertIn('api_key=[REDACTED]', s)

    def test_logging_filter(self):
        buf = io.StringIO(); h = logging.StreamHandler(buf); h.addFilter(C.RedactFilter())
        log = logging.getLogger('t'); log.addHandler(h); log.propagate = False
        log.warning('fail %s', f'/traffic/events?api_key={FAKE}')
        self.assertNotIn(FAKE, buf.getvalue())

    def test_token_file_perms_enforced(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 't'; p.write_text(FAKE + '\n'); os.chmod(p, 0o644)
            with self.assertRaises(PermissionError): C.load_token(p)
            os.chmod(p, 0o600); self.assertEqual(C.load_token(p), FAKE)

    def test_public_url_has_no_key(self):
        self.assertNotIn('api_key', C.PUBLIC_URL_511)

class ShadowCycle(unittest.TestCase):
    """Full cycle against a temp DB with network fetchers stubbed out."""
    def test_cycle(self):
        ev = i80_event()
        lat, lon = ev['geography']['coordinates'][1], ev['geography']['coordinates'][0]
        leaky = json.loads(json.dumps(FIX)); leaky['meta']['url'] = f'/traffic/events?api_key={FAKE}&format=json'
        def fake_public(name, url):
            data = lcs_payload(lat + 0.001, lon) if name.startswith('caltrans') else {'features': [{}, {}]}
            key = 'data' if name.startswith('caltrans') else 'features'
            return dict(url=url, data=data, n=len(data[key]), status=200, attempts=1, ms=5, remaining=None)
        def fake_511(token):
            self.assertEqual(token, FAKE)
            return dict(url=C.PUBLIC_URL_511, data=json.loads(C.redact(json.dumps(leaky))), n=len(leaky['events']),
                        status=200, attempts=1, ms=5, remaining=55)
        with tempfile.TemporaryDirectory() as d:
            tok = Path(d) / 'tok'; tok.write_text(FAKE); os.chmod(tok, 0o600)
            old = (C.fetch_public, C.fetch_511, C.TOKEN_PATH)
            C.fetch_public, C.fetch_511 = fake_public, fake_511
            C.load_token.__defaults__ = (tok,)
            try:
                db = Path(d) / 's.db'
                C.cycle(db); C.cycle(db)
            finally:
                C.fetch_public, C.fetch_511 = old[0], old[1]
                C.load_token.__defaults__ = (old[2],)
            c = sqlite3.connect(db)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM incidents WHERE source='511-bayarea'").fetchone()[0], len(FIX['events']))
            self.assertEqual(c.execute('SELECT COUNT(*) FROM incidents WHERE published!=0').fetchone()[0], 0)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM incidents WHERE verification_status!='unverified_official'").fetchone()[0], 0)
            self.assertGreaterEqual(c.execute('SELECT COUNT(*) FROM duplicate_links').fetchone()[0], 1)
            self.assertEqual(c.execute("SELECT state FROM source_health WHERE source='511-bayarea'").fetchone()[0], 'OK')
            self.assertEqual(c.execute("SELECT COUNT(*) FROM ingest_stats WHERE source='511-bayarea' AND ok=1").fetchone()[0], 2)
            self.assertEqual(c.execute("SELECT COUNT(*) FROM request_log WHERE source='511-bayarea'").fetchone()[0], 2)
            dump = '\n'.join(c.iterdump())
            self.assertNotIn(FAKE, dump)
            with self.assertRaises(sqlite3.IntegrityError):
                c.execute("UPDATE incidents SET published=1")

if __name__ == '__main__':
    unittest.main()
