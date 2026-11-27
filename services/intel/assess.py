import json, sqlite3, time, math
from datetime import datetime
from pathlib import Path
from shapely.geometry import Point, LineString, shape
from shapely.strtree import STRtree
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
 for row in payload.get('data',[]) if source.startswith('caltrans') else payload.get('features',[]):
  try:
   if source.startswith('caltrans'):
    c=row['lcs']; loc=c['location']; cl=c['closure']; ts=cl['closureTimestamp']
    start=epoch(ts['closureStartEpoch']); end=epoch(ts['closureEndEpoch'])
    if start is None or end is None or not start<=now<end: continue
    a=point(loc['begin'],'begin'); b=point(loc['end'],'end')
    if a is None or b is None: continue
    # Endpoints alone are not a verified road path. Flag nearby work only,
    # never infer a complete route closure from a point/chord intersection.
    for i,p in enumerate((a,b)):
     events.append(dict(id=source+':'+c['index']+':'+str(i),source=source,kind='roadwork',title=cl['typeOfClosure']+' - '+cl['typeOfWork'],road=loc['begin']['beginRoute'],expires=end,geometry=p,precision='closure endpoint'))
   elif source.startswith('nws'):
    p=row['properties']; start=epoch(p.get('onset') or p.get('effective')); end=epoch(p.get('expires'))
    if p.get('status')!='Actual' or start is None or end is None or not start<=now<end or not row.get('geometry'): continue
    geom=shape(row['geometry'])
    if geom.is_empty or not geom.is_valid or geom.geom_type not in ('Polygon','MultiPolygon'): continue
    events.append(dict(id=row['id'],source=source,kind='weather',title=p['event'],road=None,expires=end,geometry=geom,precision='official alert polygon'))
  except (KeyError,TypeError,ValueError,AttributeError): continue
 return events
def assess(now=None):
 now=now or time.time()
 events=[]; health={}
 with sqlite3.connect(ROOT/'shadow.sqlite3') as db:
  for name,checked,ok,detail in db.execute('select * from health'): health[name]={'checked_at':checked,'ok':bool(ok),'detail':detail}
  for name,url,fetched,payload,count in db.execute('select * from snapshots'):
   if now-fetched>900 or not health.get(name,{}).get('ok'): continue
   events.extend(normalize(name,json.loads(payload),now))
 tree=STRtree([e['geometry'] for e in events])
 routes={}
 for state in ('california','florida'):
  catalog=json.loads((DATA/(state+'-catalog.json')).read_text())
  roads=json.loads((DATA/(state+'-road-routes.json')).read_text())
  for row in catalog:
   road=roads.get(row['id'])
   if not road or len(road.get('coordinates',[]))<2: continue
   line=LineString(road['coordinates'])
   matches=[]
   for idx in tree.query(line.buffer(0.0003)):
    e=events[int(idx)]
    if e['source'].startswith('nws') and not e['source'].endswith('CA' if state=='california' else 'FL'): continue
    if e['kind']=='weather' and not line.intersects(e['geometry']): continue
    if e['kind']=='roadwork' and line.distance(e['geometry'])>0.0003: continue
    # Proximity is not road identity. Keep roadwork candidates internal.
    matches.append({k:v for k,v in e.items() if k!='geometry'})
   routes[row['slug']]={'status':'CAUTION' if any(m['kind']=='weather' for m in matches) else 'UNKNOWN','candidates':matches,'coverage':'partial','publication':'shadow'}
 return {'generated_at':int(now),'mode':'shadow','health':health,'normalized_candidates':len(events),'routes':routes}
if __name__=='__main__':
 result=assess()
 tmp=ROOT/'assessments.tmp'; tmp.write_text(json.dumps(result)); tmp.replace(ROOT/'assessments.json')
 print('routes',len(result['routes']),'candidates',result['normalized_candidates'],'routes_with_candidates',sum(bool(r['candidates']) for r in result['routes'].values()))
