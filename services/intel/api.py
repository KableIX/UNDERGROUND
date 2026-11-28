import json,time,threading,logging
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit
from assess import assess,fresh_source
from pathlib import Path
ROOT=Path(__file__).parent
def refresh():
 while True:
  try:
   data=assess()
   temp=ROOT/'assessments.tmp'
   temp.write_text(json.dumps(data))
   temp.replace(ROOT/'assessments.json')
   logging.info('assessed %d routes',len(data['routes']))
  except Exception:
   logging.exception('assessment failed')
  time.sleep(300)
def public_route(data,slug,now):
 route=data.get('routes',{}).get(slug)
 if not route:return None
 fresh=0<=now-data.get('generated_at',0)<=600
 # Only expose valid official weather polygons, never nearby closure candidates.
 source='nws-'+route.get('state','')
 checked=data.get('weather_snapshots',{}).get(source)
 weather_check={'state':'unknown','checked_at':None,'expires':None}
 if (fresh and route.get('geometry_status')=='mapped' and isinstance(checked,(int,float))
     and 0<=now-checked<900 and fresh_source(data.get('health',{}),source,now)):
  deadline=min(checked+900,data['generated_at']+600,data['health'][source]['checked_at']+900)
  if deadline>now:weather_check={'state':'fresh','checked_at':checked,'expires':deadline}
 weather=[]
 if weather_check['state']=='fresh':
  for e in route.get('candidates',[]):
   if e['kind']!='weather' or e['source']!=source or e['expires']<=now:continue
   expires=min(e['expires'],weather_check['expires'])
   if expires>now:
    weather.append({'id':e.get('id',source+':'+e['title']),'title':e['title'],'source':source,
                    'expires':expires,'severity':e.get('severity','Unknown'),'segments':e.get('segments',[])})
 return {'route':slug,'status':'CAUTION' if weather else 'UNKNOWN','coverage':'partial','generated_at':data['generated_at'],'weather':weather,'weather_check':weather_check,'geometry_status':route.get('geometry_status','unmapped'),'road_status':'Not assessed','mode':'limited_preview'}

def public_index(data,now):
 """One compact refresh for catalog badges; never expose shadow road matches."""
 result={}
 for slug in data.get('routes',{}):
  route=public_route(data,slug,now)
  result[slug]={'weather_check':route['weather_check'],'weather':[{'id':e['id'],'title':e['title'],'source':e['source'],'expires':e['expires'],'severity':e['severity']} for e in route['weather']]}
 return {'generated_at':data['generated_at'],'routes':result,'mode':'limited_preview'}

class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=urlsplit(self.path).path
  try:
   data=json.loads((ROOT/'assessments.json').read_text())
   if path=='/health':
    result={'ok':True,'age_seconds':int(time.time()-data['generated_at']),'mode':'shadow','routes':len(data['routes'])}
   elif path=='/v1/routes':
    result=public_index(data,time.time())
   elif path.startswith('/v1/routes/'):
    result=public_route(data,path.split('/')[-1],time.time())
    if result is None:return self.send_error(404)
   else:return self.send_error(404)
   raw=json.dumps(result).encode()
   self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
  except (OSError,ValueError,KeyError):self.send_error(503)
if __name__=='__main__':
 logging.basicConfig(level=logging.INFO)
 threading.Thread(target=refresh,daemon=True).start()
 ThreadingHTTPServer(('127.0.0.1',8766),Handler).serve_forever()
