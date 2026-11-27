import json, sqlite3, time, math
from datetime import datetime
from pathlib import Path
from shapely.geometry import Point, LineString, shape
from shapely.strtree import STRtree
from collector import geo_valid
ROOT=Path(__file__).parent
DATA=ROOT.parent.parent/'apps/mobile/src/data'
def epoch(value):
 try:
  return float(value) if str(value).isdigit() else datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()
 except (ValueError,TypeError,AttributeError): return None
def point(location,prefix):
 try:
  x=float(location[prefix+'Longitude']); y=float(location[prefix+'Latitude'])
  if math.isfinite(x) and math.isfinite(y) and -180<=x<=180 and -90<=y<=90 and (x or y): return Point(x,y)
 except (ValueError,TypeError,KeyError): pass
 return None
def normalize(source,payload,now):
 events=[]
 for row in payload.get('features',[]):
  try:
   if source in ('nws-CA','nws-FL'):
    p=row['properties']; start=epoch(p.get('onset') or p.get('effective')); end=epoch(p.get('expires'))
    if p.get('status')!='Actual' or p.get('messageType')=='Cancel' or start is None or end is None or not start<=now<end or not row.get('geometry'): continue
    geom=shape(row['geometry'])
    if geom.is_empty or not geom.is_valid or geom.geom_type not in ('Polygon','MultiPolygon'): continue
    events.append(dict(id=row['id'],source=source,kind='weather',title=p['event'],road=None,expires=end,geometry=geom,precision='official alert polygon',severity=p.get('severity','Unknown')))
  except (KeyError,TypeError,ValueError,AttributeError): continue
 return events
def fresh_source(health, source, now):
 h=health.get(source,{})
 return bool(h.get('ok')) and 0<=now-h.get('checked_at',0)<=900

ROAD_CATEGORIES={'closure','construction','accident','debris_hazard','fire','weather','disabled_vehicle'}

def road_candidates(db, health, now):
 """Shadow-only official road events; spatial proximity is not a road identity."""
 db.row_factory=sqlite3.Row
 for r in db.execute("""SELECT source,source_id,category,headline,road_name,lat,lon,end_lat,end_lon,
 geometry,expires_at,starts_at,status,upstream FROM incidents
 WHERE active=1 AND published=0 AND geo_valid=1 AND expires_at>? AND (starts_at IS NULL OR starts_at<=?)""",(now,now)):
  source=r['source']
  if not fresh_source(health,source,now) or r['category'] not in ROAD_CATEGORIES: continue
  if source=='511-bayarea':
   if r['status']!='ACTIVE': continue
   # No enforcement reports, unknown originators or user-generated data.
   if not r['upstream'] or r['upstream'].lower() not in ('chp','caltrans','local agency','local agencies'): continue
   coords=[]
   try:
    g=shape(json.loads(r['geometry']))
    if g.geom_type=='Point' and geo_valid(g.y,g.x): coords=[g]
    elif g.geom_type in ('LineString','MultiLineString') and g.is_valid and not g.is_empty:
     minx,miny,maxx,maxy=g.bounds
     if geo_valid(miny,minx) and geo_valid(maxy,maxx): coords=[g]
   except (ValueError,TypeError,AttributeError,KeyError): pass
  elif source in ('caltrans-d4','caltrans-d5'):
   if r['status']!='IN_PLACE': continue
   coords=[Point(x,y) for x,y in ((r['lon'],r['lat']),(r['end_lon'],r['end_lat'])) if geo_valid(y,x)]
  else: continue
  for i,g in enumerate(coords):
   yield dict(id=f"{source}:{r['source_id']}:{i}",source=source,kind='roadwork',category=r['category'],title=r['headline'] or r['category'],road=r['road_name'],expires=r['expires_at'],geometry=g,precision='provider geometry; road identity unverified' if source=='511-bayarea' else 'closure endpoint')

def weather_segments(line, polygon):
 """Return bounded route-only display geometry; never create a point hazard."""
 clipped=line.intersection(polygon)
 if clipped.geom_type=='LineString': parts=[clipped]
 elif clipped.geom_type in ('MultiLineString','GeometryCollection'):
  parts=[g for g in clipped.geoms if g.geom_type=='LineString']
 else: parts=[]
 parts=sorted(parts,key=lambda g:g.length,reverse=True)[:8]
 result=[]
 for part in parts:
  coordinates=list(part.coords)
  # Preserve the intersection exactly, including bends and polygon boundaries.
  if 2<=len(coordinates)<=1200: result.append([list(c) for c in coordinates])
 return result

def assess(now=None, db_path=None, data_path=None):
 now=time.time() if now is None else now
 data_path=Path(data_path or DATA)
 events=[]; health={}
 with sqlite3.connect(db_path or ROOT/'shadow.sqlite3') as db:
  for name,checked,ok,detail in db.execute('select * from health'): health[name]={'checked_at':checked,'ok':bool(ok),'detail':detail}
  for name,url,fetched,payload,count in db.execute('select * from snapshots'):
   if name not in ('nws-CA','nws-FL') or not 0<=now-fetched<=900 or not fresh_source(health,name,now): continue
   events.extend(normalize(name,json.loads(payload),now))
  events.extend(road_candidates(db,health,now))
 tree=STRtree([e['geometry'] for e in events])
 routes={}
 for state in ('california','florida'):
  catalog=json.loads((data_path/(state+'-catalog.json')).read_text())
  roads=json.loads((data_path/(state+'-road-routes.json')).read_text())
  for row in catalog:
   road=roads.get(row['id'])
   if not road or len(road.get('coordinates',[]))<2: continue
   line=LineString(road['coordinates'])
   matches=[]
   for idx in tree.query(line.buffer(0.0003)):
    e=events[int(idx)]
    if e['source'].startswith('nws') and not e['source'].endswith('CA' if state=='california' else 'FL'): continue
    if e['kind']=='weather' and not line.intersects(e['geometry']): continue
    if e['kind']=='roadwork' and state!='california': continue
    if e['kind']=='roadwork' and line.distance(e['geometry'])>0.0003: continue
    # Proximity is not road identity. Keep roadwork candidates internal.
    item={k:v for k,v in e.items() if k!='geometry'}
    if e['kind']=='weather':
     item['segments']=weather_segments(line,e['geometry'])
    else:
     item['road_identity']='unverified'
     item['publication']='shadow'
    matches.append(item)
   routes[row['slug']]={'status':'CAUTION' if any(m['kind']=='weather' for m in matches) else 'UNKNOWN','candidates':matches,'coverage':'partial','publication':'shadow'}
 return {'generated_at':int(now),'mode':'shadow','health':health,'normalized_candidates':len(events),'routes':routes}
if __name__=='__main__':
 result=assess()
 tmp=ROOT/'assessments.tmp'; tmp.write_text(json.dumps(result)); tmp.replace(ROOT/'assessments.json')
 print('routes',len(result['routes']),'candidates',result['normalized_candidates'],'routes_with_candidates',sum(bool(r['candidates']) for r in result['routes'].values()))
