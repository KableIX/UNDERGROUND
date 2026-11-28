import sqlite3, unittest
import collector as C
from test_collector_511 import lcs_payload, NOW

class Retention(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        C.init_db(self.db)
    def tearDown(self):
        self.db.close()
    def rows(self, end, lifted=False):
        return C.normalize_lcs('caltrans-d4',lcs_payload(37.5,-122.1,end=end,lifted=lifted),NOW)
    def test_repeated_ended_record_expires_once(self):
        rows=self.rows(NOW+60)
        self.assertEqual(C.upsert_incidents(self.db,'caltrans-d4',rows,NOW),(1,0,0))
        self.assertEqual(C.upsert_incidents(self.db,'caltrans-d4',rows,NOW+60),(0,1,1))
        self.assertEqual(C.upsert_incidents(self.db,'caltrans-d4',rows,NOW+300),(0,1,0))
        self.assertEqual(self.db.execute('SELECT active,withdrawn_at FROM incidents').fetchone(),(0,NOW+60))
    def test_initial_ended_and_lifted_are_inactive(self):
        for rows in (self.rows(NOW-60),self.rows(NOW+60,True)):
            self.assertEqual(C.upsert_incidents(self.db,'caltrans-d4',rows,NOW)[2],0)
            self.assertEqual(self.db.execute('SELECT active FROM incidents').fetchone()[0],0)
    def test_reopened_event_can_expire_again(self):
        C.upsert_incidents(self.db,'caltrans-d4',self.rows(NOW-60),NOW)
        C.upsert_incidents(self.db,'caltrans-d4',self.rows(NOW+600),NOW+10)
        self.assertEqual(self.db.execute('SELECT active,withdrawn_at FROM incidents').fetchone(),(1,None))
        self.assertEqual(C.upsert_incidents(self.db,'caltrans-d4',[],NOW+20)[2],1)
        self.assertEqual(C.upsert_incidents(self.db,'caltrans-d4',[],NOW+30)[2],0)
    def test_cleanup_retains_tombstone_then_purges_unseen(self):
        rows=self.rows(NOW-60)
        C.upsert_incidents(self.db,'caltrans-d4',rows,NOW)
        later=NOW+C.RAW_RETENTION_S+1
        C.upsert_incidents(self.db,'caltrans-d4',rows,later)
        C.cleanup(self.db,later)
        self.assertEqual(self.db.execute('SELECT active,raw,withdrawn_at FROM incidents').fetchone(),(0,'{}',NOW))
        self.assertEqual(C.cleanup(self.db,later+C.RETENTION_S+1),1)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM incidents').fetchone()[0],0)
    def test_cleanup_expires_failed_source_and_old_audit(self):
        C.upsert_incidents(self.db,'caltrans-d4',self.rows(NOW+60),NOW)
        self.db.execute("INSERT INTO ingest_stats(cycle_at,source,ok,state) VALUES (?,?,?,?)",(NOW-C.RETENTION_S-1,'test',1,'OK'))
        self.db.execute("INSERT INTO request_log VALUES (?,?)",('test',NOW-86401))
        C.cleanup(self.db,NOW+60)
        self.assertEqual(self.db.execute('SELECT active,withdrawn_at,published FROM incidents').fetchone(),(0,NOW+60,0))
        for table in ('ingest_stats','request_log'):
            self.assertEqual(self.db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0],0)
