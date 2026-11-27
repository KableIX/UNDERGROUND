"""Rebuild the beta's offline camera index. Run with Python 3.10+ and network access."""
import concurrent.futures
import datetime
import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

OUTPUT = Path(__file__).resolve().parents[1] / "apps/mobile/src/data/california-cameras.json"
BOUNDARY = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0"
READERS = "https://data.dontgetflocked.com/cameras.geojson.gz"
SJ = "https://geo.sanjoseca.gov/server/rest/services/DOT/DOT_TrafficSignalsParkingOpsLayers/MapServer/26"
LA = "https://services.arcgis.com/G3nmNsarwQblLhip/arcgis/rest/services/CameraSystems_streetnames2/FeatureServer/0"
OAK = "https://services.arcgis.com/9tC74aDHuml0x5Yz/arcgis/rest/services/Proposed_ASE_Locations_wSpeednPopData/FeatureServer/0"
SF = "https://data.sfgov.org/resource/d5uh-bk84.json"
OVERPASS = ["https://ovp.dresel.systems/api-na/interpreter","https://overpass-api.de/api/interpreter"]

def download(url, **params):
    if params:
        url += "?" + urlencode(params)
    req = Request(url, headers={"User-Agent": "UNDERGROUND-California-map/1"})
    with urlopen(req, timeout=85) as resp:
        raw = resp.read()
    return json.loads(gzip.decompress(raw) if raw.startswith(b"\x1f\x8b") else raw)

def arc(layer, where="1=1"):
    data = download(layer + "/query", where=where, outFields="*", returnGeometry="true", outSR=4326, f="geojson")
    if data.get("exceededTransferLimit") or data.get("properties", {}).get("exceededTransferLimit"):
        raise ValueError("Truncated ArcGIS layer: " + layer)
    return data["features"]

def speed_nodes():
    query = '[out:json][timeout:55];area(3600165475)->.ca;node["highway"="speed_camera"](area.ca);out body;'
    for endpoint in OVERPASS:
        try:
            data = download(endpoint, data=query)
            if data.get("remark") or not data["elements"]:
                raise ValueError("Incomplete Overpass response")
            return data["elements"]
        except (OSError, ValueError, KeyError) as e:
            last_error = e
    raise RuntimeError("Speed-camera refresh failed") from last_error

def state_test(geometry):
    # Latitude strips limit ray crossings to nearby polygon edges, including holes and islands.
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    bands = defaultdict(list)
    for polygon in polygons:
        for ring in polygon:
            for (x,y), (xx,yy) in zip(ring,ring[1:]):
                if y == yy:
                    continue
                for strip in range(math.floor(min(y,yy)*10),math.floor(max(y,yy)*10)+1):
                    bands[strip].append((x,y,xx,yy))
    def inside(lon,lat):
        if not (-125 < lon < -114 and 32 < lat < 43):
            return False
        crossings = sum(1 for x,y,xx,yy in bands[math.floor(lat*10)]
                        if (y > lat) != (yy > lat) and lon < x+(lat-y)*(xx-x)/(yy-y))
        return crossings % 2 == 1
    return inside

def main():
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        boundary = pool.submit(download, BOUNDARY+"/query", where="GEOID='06'", outFields="GEOID", returnGeometry="true", outSR=4326, maxAllowableOffset=0.001, f="geojson")
        readers = pool.submit(download, READERS)
        speeds = pool.submit(speed_nodes)
        cities = {code: pool.submit(arc, url) for code,url in [('sj',SJ),('la',LA),('oak',OAK)]}
        sf = pool.submit(download, SF, **{'$select':'site_id,location,latitude,longitude,max(date) as last_date',
            '$group':'site_id,location,latitude,longitude','$where':'latitude is not null','$limit':5000})
    inside = state_test(boundary.result()["features"][0]["geometry"])
    cells = defaultdict(list)
    counts = Counter()
    seen = set()
    def add(lon,lat,kind,source,key,label='',status=''):
        if not inside(lon,lat) or (source,key) in seen:
            return
        seen.add((source,key))
        cell = f"{math.floor(lon*10)},{math.floor(lat*10)}"
        cells[cell].append([round(lon,6),round(lat,6),kind,source,str(key),label or '',status or ''])
        counts[source] += 1
    for f in readers.result()['features']:
        p = f['properties']
        if f['geometry']['type']=='Point':
            add(*f['geometry']['coordinates'][:2], 'plate','reader',
                p['osmType']+'/'+str(p['osmId']),p.get('brand',''))
    official = []
    for city,future in cities.items():
        for f in future.result():
            p,g = f['properties'],f['geometry']
            if city=='sj' and p['CAMERATYPE']!='Speed':
                continue
            if g['type']!='Point':
                raise ValueError(f'Expected a published point for {city}')
            lon,lat = g['coordinates'][:2]
            add(lon,lat,'speed',city,p['OBJECTID'],p.get('LOCATION') or p.get('StreetName') or p.get('Street') or '',
                (p.get('System') if city=='la' else p.get('STATUS')) or '')
            official.append((lon,lat))
    # Citation activity supplies coordinates. Never infer today's operating status from it.
    for p in sorted(sf.result(), key=lambda p:p['last_date'],reverse=True):
        lon,lat=float(p['longitude']),float(p['latitude'])
        add(lon,lat,'speed','sf',p['site_id'],p['location'])
        official.append((lon,lat))
    for p in speeds.result():
        lon,lat=p['lon'],p['lat']
        if any(math.hypot((lon-x)*math.cos(math.radians(lat)),lat-y)*111320 < 50 for x,y in official):
            continue
        add(lon,lat,'speed','osm',p['id'],p.get('tags',{}).get('name'))
    for source,minimum in {'reader':10000,'osm':1,'sj':1,'oak':1,'sf':1,'la':1}.items():
        if counts[source] < minimum:
            raise ValueError(f'Incomplete source {source}: {counts[source]}')
    if OUTPUT.exists():
        previous=json.loads(OUTPUT.read_text(encoding='utf-8'))
        for source,n in previous['counts'].items():
            if counts[source]<n*.75:
                raise ValueError(f'Large unexplained drop in {source}; retaining previous snapshot')
    for rows in cells.values():
        rows.sort(key=lambda row:(row[3],row[4]))
    data={'retrieved':datetime.datetime.now(datetime.timezone.utc).date().isoformat(),
          'attribution':'Camera locations © OpenStreetMap contributors (ODbL 1.0), San José DOT, SFMTA, OakDOT, LADOT. Boundary: US Census.',
          'counts':counts,'cells':dict(sorted(cells.items()))}
    tmp=OUTPUT.with_suffix('.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    tmp.replace(OUTPUT)
    print(dict(counts))

if __name__ == '__main__':
    main()
