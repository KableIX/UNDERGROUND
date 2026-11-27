import json, time, sqlite3, urllib.request, logging
from pathlib import Path
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).parent
SOURCES={**{f'caltrans-d{d}':f'https://cwwp2.dot.ca.gov/data/d{d}/lcs/lcsStatusD{d:02}.json' for d in (4,5)},**{f'nws-{s}':f'https://api.weather.gov/alerts/active?area={s}' for s in ('CA','FL')}}
def fetch(item):
 name,url=item
 req=urllib.request.Request(url,headers={'User-Agent':'UNDERGROUND-INTEL/0.1 (road condition research)','Accept':'application/geo+json, application/json'})
 with urllib.request.urlopen(req,timeout=25) as r:
  raw=r.read(25_000_001)
  if len(raw)>25_000_000: raise ValueError('response too large')
  data=json.loads(raw)
  key='data' if name.startswith('caltrans') else 'features'
  if not isinstance(data.get(key),list): raise ValueError('unexpected schema')
  return name,url,data,len(data[key])
def cycle():
 with sqlite3.connect(ROOT/'shadow.sqlite3') as db:
  db.execute('CREATE TABLE IF NOT EXISTS snapshots (source TEXT PRIMARY KEY,url TEXT NOT NULL,fetched_at INTEGER NOT NULL,payload TEXT NOT NULL,record_count INTEGER NOT NULL)')
  db.execute('CREATE TABLE IF NOT EXISTS health (source TEXT PRIMARY KEY,checked_at INTEGER NOT NULL,ok INTEGER NOT NULL,detail TEXT NOT NULL)')
  with ThreadPoolExecutor(max_workers=4) as pool:
   jobs={pool.submit(fetch,item):item[0] for item in SOURCES.items()}
   for job,name in jobs.items():
    try:
     name,url,data,n=job.result()
     db.execute('INSERT OR REPLACE INTO snapshots VALUES (?,?,?,?,?)',(name,url,int(time.time()),json.dumps(data),n))
     db.execute('INSERT OR REPLACE INTO health VALUES (?,?,?,?)',(name,int(time.time()),1,str(n)))
     logging.info('%s records=%s',name,n)
    except Exception as e:
     db.execute('INSERT OR REPLACE INTO health VALUES (?,?,?,?)',(name,int(time.time()),0,type(e).__name__))
     logging.warning('%s failure %s',name,type(e).__name__)
  db.commit()
if __name__=='__main__':
 logging.basicConfig(level=logging.INFO)
 import sys
 while True:
  cycle()
  if '--once' in sys.argv: break
  time.sleep(300)
