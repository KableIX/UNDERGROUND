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
 weather=[{'id':e.get('id',e['source']+':'+e['title']), 'title':e['title'],'source':e['source'],
           'expires':min(e['expires'], data['generated_at']+600, data['health'][e['source']]['checked_at']+900),
           'severity':e.get('severity','Unknown'), 'segments':e.get('segments',[])}
          for e in route['candidates'] if e['kind']=='weather' and e['source'] in ('nws-CA','nws-FL') and e['expires']>now and fresh_source(data.get('health',{}),e['source'],now)] if fresh else []
 return {'route':slug,'status':'CAUTION' if weather else 'UNKNOWN','coverage':'partial','generated_at':data['generated_at'],'weather':weather,'road_status':'Not assessed','mode':'limited_preview'}
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=urlsplit(self.path).path
  try:
   data=json.loads((ROOT/'assessments.json').read_text())
   if path=='/health':
    result={'ok':True,'age_seconds':int(time.time()-data['generated_at']),'mode':'shadow','routes':len(data['routes'])}
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
