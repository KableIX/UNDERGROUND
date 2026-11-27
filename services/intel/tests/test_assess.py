import json,sqlite3,tempfile,unittest
from pathlib import Path
from shapely.geometry import Point
import collector as C
from assess import road_candidates,assess,fresh_source
from api import public_route
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
  data={'generated_at':NOW,'health':{'nws-CA':{'ok':True,'checked_at':NOW}},'routes':{'test':{'candidates':[event]}}}
  self.assertEqual(public_route(data,'test',NOW)['status'],'CAUTION')
  data['health']['nws-CA']['checked_at']=NOW-901
  self.assertEqual(public_route(data,'test',NOW)['status'],'UNKNOWN')
  data['health']['nws-CA']['checked_at']=NOW
  self.assertEqual(public_route(data,'test',NOW+601)['status'],'UNKNOWN')
  self.assertIsNone(public_route(data,'missing',NOW))
 def test_future_source_rejected(self):
  self.assertFalse(fresh_source({'nws-CA':{'ok':True,'checked_at':NOW+1}},'nws-CA',NOW))
