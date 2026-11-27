"""Build preview only from OpenStreetMap way nodes; never invent connecting lines."""
import os, json, xml.etree.ElementTree as E
from pathlib import Path
from collections import defaultdict
import argparse, urllib.request, datetime
parser=argparse.ArgumentParser()
parser.add_argument('--source', type=Path, help='Downloaded OSM XML; otherwise fetch the public OSM map API')
args=parser.parse_args()
source_url='https://www.openstreetmap.org/api/0.6/map?bbox=-121.985,37.368,-121.96,37.39'
raw=args.source.read_bytes() if args.source else urllib.request.urlopen(source_url,timeout=30).read()
root = E.fromstring(raw)
nodes = {int(n.attrib['id']): [float(n.attrib['lon']),float(n.attrib['lat'])] for n in root.findall('node')}
roads = ['Scott Boulevard','San Tomas Expressway','Walsh Avenue','Bowers Avenue']
ways=[]
byroad=defaultdict(set)
for w in root.findall('way'):
    tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
    if tags.get('name') in roads and tags.get('highway') not in ('footway','cycleway','path','pedestrian','service'):
        ids=[int(n.attrib['ref']) for n in w.findall('nd')]
        ways.append((int(w.attrib['id']),tags,ids))
        byroad[tags['name']].update(ids)
print('road ways',len(ways))
for i,a in enumerate(roads):
    b=roads[(i+1)%4]
    common=byroad[a]&byroad[b]
    print(a,b,[(n,nodes[n]) for n in common])

import heapq, math, hashlib
adj=defaultdict(list)
for wid,tags,ids in ways:
    if tags.get('access') in ('private','no') or tags.get('motor_vehicle')=='no': continue
    for a,b in zip(ids,ids[1:]):
        x,y=nodes[a],nodes[b]
        distance=math.hypot((x[0]-y[0])*math.cos(math.radians(x[1])),x[1]-y[1])*111195
        if tags.get('oneway') != '-1': adj[a].append((b,roads.index(tags['name']),distance,wid))
        if tags.get('oneway') not in ('yes','1','true'): adj[b].append((a,roads.index(tags['name']),distance,wid))
solutions=[]
for origin in sorted(byroad[roads[0]] & byroad[roads[3]]):
    start=(origin,0)
    costs={start:0}; prev={}; queue=[(0,start)]; goal=None
    while queue:
        cost,state=heapq.heappop(queue)
        if cost!=costs[state]: continue
        node,stage=state
        if node==origin and stage==3: goal=state; break
        for dest,road,dist,wid in adj[node]:
            if road not in (stage,stage+1): continue
            nxt=(dest,road); nc=cost+dist
            if nc<costs.get(nxt,float('inf')):
                costs[nxt]=nc; prev[nxt]=(state,wid); heapq.heappush(queue,(nc,nxt))
    if goal:
        states=[goal]; used=[]
        while states[-1]!=start:
            before,wid=prev[states[-1]]; used.append(wid); states.append(before)
        states.reverse(); used.reverse(); solutions.append((costs[goal],states,used))
assert solutions, 'No connected directed loop following required streets'
distance,states,used=min(solutions)
coordinates=[nodes[n] for n,s in states]
assert coordinates[0]==coordinates[-1]
assert set(s for n,s in states)=={0,1,2,3}
out={'type':'Feature','properties':{'slug':'nvidia-campus-loop','distanceMeters':round(distance),'startLabel':'Scott Boulevard at Bowers Avenue','direction':'Scott Boulevard > San Tomas Expressway > Walsh Avenue > Bowers Avenue > Scott Boulevard','status':'preview','source':'OpenStreetMap contributors','license':'ODbL-1.0','sourceUrl':'https://www.openstreetmap.org/copyright','downloadUrl':source_url,'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'wayIds':list(dict.fromkeys(used)),'sourceSha256':hashlib.sha256(raw).hexdigest(),'limitations':'Road-node preview respects tagged one-way edges; turn restrictions, closures, clearance and GPS gates require validation.'},'geometry':{'type':'LineString','coordinates':coordinates}}
p=Path(__file__).resolve().parents[1]/'apps/mobile/src/data/nvidia-campus-route.json'
p.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print('BUILT',len(coordinates),'road nodes;',round(distance),'meters;',len(out['properties']['wayIds']),'OSM ways; origin',coordinates[0])
