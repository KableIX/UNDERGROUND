import json,sqlite3,tempfile,unittest
from pathlib import Path
from shapely.geometry import Point,LineString,Polygon
import collector as C
from assess import road_candidates,assess,fresh_source,weather_segments,route_inventory,route_line,DATA
from api import public_route,public_index
from test_collector_511 import NOW,FIX,lcs_payload

class Assessment(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:'); C.init_db(self.db)
 def tearDown(self): self.db.close()
 def test_road_candidates_are_shadow_only(self):
  rows=C.normalize_511(FIX,NOW)
  ev=next(r for r in rows if r['category']=='accident')
  ev.update(status='ACTIVE',upstream='CHP',starts_at=NOW-100,expires_at=NOW+100,geo_valid=1,geometry=json.dumps({'type':'Point','coordinates':[ev['lon'],ev['lat']]}))
  C.upsert_incidents(self.db,C.S511,[ev],NOW)
  health={C.S511:{'ok':True,'checked_at':NOW}}
  candidates=list(road_candidates(self.db,health,NOW))
  self.assertEqual(len(candidates),1)
  self.assertEqual(candidates[0]['kind'],'roadwork')
  self.assertEqual(list(road_candidates(self.db,health,NOW+101)),[])
  self.assertEqual(list(road_candidates(self.db,{C.S511:{'ok':False,'checked_at':NOW}},NOW)),[])
  result={'generated_at':NOW,'health':health,'routes':{'test':{'candidates':candidates}}}
  self.assertEqual(public_route(result,'test',NOW)['status'],'UNKNOWN')
  self.assertEqual(public_route(result,'test',NOW)['weather'],[])
 def test_unknown_provider_and_category_filtered(self):
  ev=C.normalize_511(FIX,NOW)[0]
  ev.update(status='ACTIVE',upstream='unknown',category='accident',starts_at=NOW-100,expires_at=NOW+100,geo_valid=1)
  C.upsert_incidents(self.db,C.S511,[ev],NOW)
  health={C.S511:{'ok':True,'checked_at':NOW}}
  self.assertEqual(list(road_candidates(self.db,health,NOW)),[])
  ev.update(upstream='CHP',category='incident')
  C.upsert_incidents(self.db,C.S511,[ev],NOW)
  self.assertEqual(list(road_candidates(self.db,health,NOW)),[])
 def test_only_in_place_caltrans_closures(self):
  rows=C.normalize_lcs('caltrans-d4',lcs_payload(37.5,-122.1),NOW)
  rows[0]['status']='SCHEDULED'
  C.upsert_incidents(self.db,'caltrans-d4',rows,NOW)
  health={'caltrans-d4':{'ok':True,'checked_at':NOW}}
  self.assertEqual(list(road_candidates(self.db,health,NOW)),[])
  rows[0]['status']='IN_PLACE'
  C.upsert_incidents(self.db,'caltrans-d4',rows,NOW)
  self.assertEqual(len(list(road_candidates(self.db,health,NOW))),2)
 def test_weather_freshness(self):
  event={'kind':'weather','title':'Flood warning','source':'nws-CA','expires':NOW+10000}
  data={'generated_at':NOW,'health':{'nws-CA':{'ok':True,'checked_at':NOW}},'weather_snapshots':{'nws-CA':NOW},'routes':{'test':{'state':'CA','geometry_status':'mapped','candidates':[event]}}}
  self.assertEqual(public_route(data,'test',NOW)['status'],'CAUTION')
  data['health']['nws-CA']['checked_at']=NOW-901
  self.assertEqual(public_route(data,'test',NOW)['status'],'UNKNOWN')
  data['health']['nws-CA']['checked_at']=NOW
  self.assertEqual(public_route(data,'test',NOW+601)['status'],'UNKNOWN')
  self.assertIsNone(public_route(data,'missing',NOW))
 def test_future_source_rejected(self):
  self.assertFalse(fresh_source({'nws-CA':{'ok':True,'checked_at':NOW+1}},'nws-CA',NOW))

class WeatherOverlay(unittest.TestCase):
 def test_overlay_uses_only_intersecting_route_geometry(self):
  line=LineString([(-122.1,37.5),(-122.0,37.5),(-121.9,37.5)])
  polygon=Polygon([(-122.05,37.4),(-121.95,37.4),(-121.95,37.6),(-122.05,37.6)])
  segments=weather_segments(line,polygon)
  self.assertEqual(len(segments),1)
  self.assertAlmostEqual(segments[0][0][0],-122.05)
  self.assertAlmostEqual(segments[0][-1][0],-121.95)
  self.assertTrue(all(abs(p[1]-37.5)<1e-8 for p in segments[0]))
  self.assertEqual(weather_segments(line,polygon.buffer(-0.01).envelope.intersection(Point(-120,36))),[])
 def test_preview_expires_on_source_or_snapshot_deadline(self):
  event={'id':'test-weather','kind':'weather','title':'Flood warning','source':'nws-CA','expires':NOW+10000,'severity':'Severe','segments':[]}
  data={'generated_at':NOW,'health':{'nws-CA':{'ok':True,'checked_at':NOW-800}},'weather_snapshots':{'nws-CA':NOW},'routes':{'test':{'state':'CA','geometry_status':'mapped','candidates':[event]}}}
  out=public_route(data,'test',NOW)
  self.assertEqual(out['weather'][0]['expires'],NOW+100)
  self.assertEqual(out['weather'][0]['severity'],'Severe')
  self.assertEqual(public_route(data,'test',NOW+101)['status'],'UNKNOWN')


class RunInventory(unittest.TestCase):
 def test_all_catalog_and_legacy_routes_use_saved_geometry(self):
  routes=route_inventory(DATA)
  self.assertEqual(len(routes),113)
  self.assertTrue(all(route_line(r['coordinates']) is not None for r in routes.values()))
  self.assertEqual(sum(r['state']=='FL' for r in routes.values()),47)
  self.assertEqual(sum(r['state']=='CA' for r in routes.values()),66)
  self.assertEqual(routes['jacobs-pass']['coordinates'],json.loads((DATA/'jacobs-pass-route.json').read_text())['coordinates'])
  local=json.loads((DATA/'silicon-valley-road-routes.json').read_text())
  for slug in ('saratoga-highway-9','page-mill-road','sierra-road','mount-hamilton-road','santa-clara-cupertino'):
   self.assertEqual(routes[slug]['coordinates'],local[slug]['coordinates'])
  self.assertEqual(routes['jenner-to-point-arena']['coordinates'],routes['sonoma-coastal-crown']['coordinates']+routes['point-arena-passage']['coordinates'][1:])
  self.assertEqual(routes['saratoga-club-loop']['coordinates'],json.loads((DATA/'saratoga-club-route.json').read_text())['geometry']['coordinates'])
 def test_invalid_geometry_never_assessed(self):
  for points in ([],[[0,0]],[[0,0],[0,0]],[[0,91],[0,90]],[[0,0],[float('nan'),0]]):
   self.assertIsNone(route_line(points))
 def test_source_check_expiry_and_catalog_privacy(self):
  alert={'kind':'weather','source':'nws-CA','title':'Flood warning','expires':NOW+500}
  road={'kind':'roadwork','source':'511-bayarea','title':'private shadow candidate','expires':NOW+500}
  data={'generated_at':NOW,'health':{'nws-CA':{'ok':True,'checked_at':NOW}},
        'weather_snapshots':{'nws-CA':NOW-850},
        'routes':{'a':{'state':'CA','geometry_status':'mapped','candidates':[alert,road]},
                  'b':{'state':'FL','geometry_status':'mapped','candidates':[alert]},
                  'c':{'state':'CA','geometry_status':'unmapped','candidates':[alert]}}}
  a=public_route(data,'a',NOW)
  self.assertEqual(a['weather_check']['state'],'fresh')
  self.assertEqual(a['weather'][0]['expires'],NOW+50)
  self.assertEqual(public_route(data,'a',NOW+51)['weather'],[])
  self.assertEqual(public_route(data,'b',NOW)['weather'],[])
  self.assertEqual(public_route(data,'c',NOW)['weather'],[])
  index=public_index(data,NOW)
  self.assertNotIn('private shadow candidate',json.dumps(index))
  self.assertNotIn('segments',json.dumps(index))
  self.assertEqual(index['routes']['a']['weather_check']['expires'],NOW+50)
 def test_missing_snapshot_is_unknown_even_if_health_ok(self):
  data={'generated_at':NOW,'health':{'nws-CA':{'ok':True,'checked_at':NOW}},
        'routes':{'a':{'state':'CA','geometry_status':'mapped','candidates':[]}}}
  self.assertEqual(public_route(data,'a',NOW)['weather_check']['state'],'unknown')
