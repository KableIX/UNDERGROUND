-- Run after existing core/club migrations and 20261124000011_club_radar.sql.
-- Uses real PostgreSQL RLS with Supabase auth helpers; all fixtures roll back.
BEGIN;
INSERT INTO public.members(id,auth_user_id,member_number,display_name) VALUES
 ('11000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','009901','Radar A'),
 ('11000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','009902','Radar B'),
 ('11000000-0000-4000-8000-000000000003','aa000000-0000-4000-8000-000000000003','009903','Radar C');
INSERT INTO public.clubs(id,slug,name,founding_market,created_by_member_id) VALUES
 ('cc000000-0000-4000-8000-000000000001','radar-test-a','Radar A','california','11000000-0000-4000-8000-000000000001'),
 ('cc000000-0000-4000-8000-000000000002','radar-test-b','Radar B','california','11000000-0000-4000-8000-000000000003');
INSERT INTO public.club_memberships(club_id,member_id) VALUES
 ('cc000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000001'),
 ('cc000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000002'),
 ('cc000000-0000-4000-8000-000000000002','11000000-0000-4000-8000-000000000003');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
DO $$ DECLARE report uuid; repeated uuid;
BEGIN
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000002',gen_random_uuid(),'radar','manual',37,-122,10,now());
    RAISE EXCEPTION 'FAIL cross-club submit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000001',gen_random_uuid(),'radar','manual',37,-122,10,now()-interval '20 seconds');
    RAISE EXCEPTION 'FAIL stale GPS accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000001',gen_random_uuid(),'radar','manual',37,-122,101,now());
    RAISE EXCEPTION 'FAIL inaccurate GPS accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000001',gen_random_uuid(),'radar','manual','NaN',-122,10,now());
    RAISE EXCEPTION 'FAIL invalid coordinates accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000001',gen_random_uuid(),'police_visual','uniden_r8',37,-122,10,now(),'KA',5,'front',34.7);
    RAISE EXCEPTION 'FAIL detector certified sighting';
  EXCEPTION WHEN check_violation THEN NULL; END;
  report := public.submit_club_radar('cc000000-0000-4000-8000-000000000001','ee000000-0000-4000-8000-000000000001','radar','uniden_r8w',37,-122,10,now(),'KA',5,'front',34.7);
  repeated := public.submit_club_radar('cc000000-0000-4000-8000-000000000001','ee000000-0000-4000-8000-000000000001','radar','uniden_r8w',37,-122,10,now()-interval '20 seconds','KA',5,'front',34.7);
  IF report <> repeated OR (SELECT count(*) FROM public.club_radar_reports) <> 1 THEN RAISE EXCEPTION 'FAIL idempotency'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.club_radar_reports WHERE id=report AND reporter_id='11000000-0000-4000-8000-000000000001' AND expires_at=created_at+interval '5 minutes') THEN RAISE EXCEPTION 'FAIL author or TTL'; END IF;
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000001',gen_random_uuid(),'radar','manual',37,-122,10,now());
    RAISE EXCEPTION 'FAIL rate limiting';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'report_rate_limited' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.confirm_club_radar(report,'still_present');
    RAISE EXCEPTION 'FAIL self-confirmation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.club_radar_reports SET expires_at=now()+interval '1 day' WHERE id=report;
    RAISE EXCEPTION 'FAIL direct report mutation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000003',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.club_radar_reports) THEN RAISE EXCEPTION 'FAIL cross-club read'; END IF;
END $$;
RESET ROLE;
SELECT set_config('radar.test.report_id',(SELECT id::text FROM public.club_radar_reports LIMIT 1),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.confirm_club_radar(current_setting('radar.test.report_id')::uuid,'still_present');
    RAISE EXCEPTION 'FAIL cross-club confirmation';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

SELECT set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000002',true);
DO $$ DECLARE report uuid := current_setting('radar.test.report_id')::uuid;
BEGIN
  IF (SELECT count(*) FROM public.club_radar_reports) <> 1 THEN RAISE EXCEPTION 'FAIL same-club read'; END IF;
  PERFORM public.confirm_club_radar(report,'still_present');
  PERFORM public.confirm_club_radar(report,'still_present');
  IF (SELECT count(*) FROM public.club_radar_confirmations) <> 1 THEN RAISE EXCEPTION 'FAIL duplicate confirmation'; END IF;
  PERFORM public.confirm_club_radar(report,'gone');
  IF NOT EXISTS(SELECT 1 FROM public.club_radar_confirmations WHERE vote='gone') THEN RAISE EXCEPTION 'FAIL vote update'; END IF;
END $$;
RESET ROLE;
DELETE FROM public.club_memberships WHERE member_id='11000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.club_radar_reports) OR EXISTS(SELECT 1 FROM public.club_radar_confirmations) THEN RAISE EXCEPTION 'FAIL revoked membership read'; END IF;
END $$;
RESET ROLE;
UPDATE public.club_radar_reports SET created_at=now()-interval '6 minutes',expires_at=now()-interval '1 minute';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aa000000-0000-4000-8000-000000000001',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.club_radar_reports) THEN RAISE EXCEPTION 'FAIL expiry'; END IF;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_club_radar('cc000000-0000-4000-8000-000000000001',gen_random_uuid(),'radar','manual',37,-122,10,now());
    RAISE EXCEPTION 'FAIL anonymous submission';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ DECLARE removed bigint;
BEGIN
  removed := public.purge_expired_club_radar();
  IF removed <> 1 OR EXISTS(SELECT 1 FROM public.club_radar_confirmations) THEN RAISE EXCEPTION 'FAIL purge or cascading confirmations'; END IF;
END $$;
ROLLBACK;
