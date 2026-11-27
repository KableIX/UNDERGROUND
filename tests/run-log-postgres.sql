-- Disposable checks for 20261127000001_run_log.sql (Supabase auth emulated).
-- Targets the schema as of 20261127000001/0002. 20261127000003 drops the photo location
-- and path columns checked here; its checks are in route-top-three-photo-privacy-postgres.sql.
-- Run against a throwaway database with every migration applied. Rolls back.
BEGIN;
INSERT INTO public.members (id, auth_user_id, member_number, display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','000101','A'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','000102','B');

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

INSERT INTO public.route_run_attempts (member_id, attempt_id, route_slug, outcome, abort_reason, progress_m, progress_pct,
  started_at, ended_at, finished_at, distance_m, active_ms, moving_ms, stopped_ms, gps_coverage_pct, good_fix_pct, sample_count, signal_gap_count)
VALUES
 ('11111111-1111-4111-8111-111111111111','trip_a1','big-sur-coastal-crown','completed',NULL,12000,100,now()-interval '1 hour',now()-interval '40 minutes',now()-interval '40 minutes',12000,1200000,1100000,100000,99,90,800,0),
 ('11111111-1111-4111-8111-111111111111','trip_a2','big-sur-coastal-crown','aborted','traffic',3000,25,now()-interval '30 minutes',now()-interval '20 minutes',NULL,3000,600000,400000,200000,97,88,300,1),
 ('22222222-2222-4222-8222-222222222222','trip_b1','big-sur-coastal-crown','aborted','weather',1000,8,now()-interval '30 minutes',now()-interval '25 minutes',NULL,1000,300000,200000,100000,95,80,100,0);

DO $check$
BEGIN
  BEGIN
    INSERT INTO public.route_run_attempts (member_id, attempt_id, route_slug, outcome, abort_reason, progress_m, progress_pct,
      started_at, ended_at, finished_at, distance_m, active_ms, moving_ms, stopped_ms, gps_coverage_pct, good_fix_pct, sample_count, signal_gap_count)
    VALUES ('11111111-1111-4111-8111-111111111111','trip_bad','x','aborted',NULL,0,0,now(),now(),NULL,0,0,0,0,0,0,0,0);
    RAISE EXCEPTION 'FAIL: abort without a reason accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: abort requires a reason';
  END;
  BEGIN
    INSERT INTO public.route_run_attempts (member_id, attempt_id, route_slug, outcome, abort_reason, progress_m, progress_pct,
      started_at, ended_at, finished_at, distance_m, active_ms, moving_ms, stopped_ms, gps_coverage_pct, good_fix_pct, sample_count, signal_gap_count)
    VALUES ('11111111-1111-4111-8111-111111111111','trip_bad2','x','aborted','bored',0,0,now(),now(),NULL,0,0,0,0,0,0,0,0);
    RAISE EXCEPTION 'FAIL: unknown abort reason accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: abort reason list enforced';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points)
    VALUES ('11111111-1111-4111-8111-111111111111','trip_a1','car',20);
    RAISE EXCEPTION 'FAIL: credit without a GPS-validated finish accepted';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: credit requires a validated finish';
  END;
END
$check$;

INSERT INTO public.route_run_finishes (member_id, attempt_id, route_slug, duration_ms)
VALUES ('11111111-1111-4111-8111-111111111111','trip_a1','big-sur-coastal-crown',1200000);

DO $check$
BEGIN
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_photo_path)
    VALUES ('11111111-1111-4111-8111-111111111111','trip_a1','car',20,'runs/22222222-2222-4222-8222-222222222222/trip_a1/car.jpg');
    RAISE EXCEPTION 'FAIL: photo path outside the member prefix accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: photo path pinned to member and attempt';
  END;
END
$check$;

INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_status, dash_status, car_photo_path, dash_photo_path, car_lat, car_lng, dash_lat, dash_lng)
VALUES ('11111111-1111-4111-8111-111111111111','trip_a1','top',30,'accepted','accepted',
 'runs/11111111-1111-4111-8111-111111111111/trip_a1/car.jpg','runs/11111111-1111-4111-8111-111111111111/trip_a1/dash.jpg',36.27,-121.8,36.27,-121.8);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $check$
DECLARE n integer; t text; h record;
BEGIN
  SELECT count(*) INTO n FROM public.route_run_attempts;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: member sees % attempts, expected own 2', n; END IF;
  RAISE NOTICE 'PASS: member reads only own attempts';

  SELECT tier INTO t FROM public.route_run_credits WHERE attempt_id = 'trip_a1';
  IF t IS DISTINCT FROM 'top' THEN RAISE EXCEPTION 'FAIL: own credit tier unreadable'; END IF;
  RAISE NOTICE 'PASS: member reads own credit tier';

  BEGIN
    PERFORM car_lat FROM public.route_run_credits;
    RAISE EXCEPTION 'FAIL: photo location readable by member';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: photo location hidden from clients';
  END;
  BEGIN
    PERFORM car_photo_path FROM public.route_run_credits;
    RAISE EXCEPTION 'FAIL: photo path readable by member';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: photo path hidden from clients';
  END;
  BEGIN
    INSERT INTO public.route_run_attempts (member_id, attempt_id, route_slug, outcome, abort_reason, progress_m, progress_pct,
      started_at, ended_at, finished_at, distance_m, active_ms, moving_ms, stopped_ms, gps_coverage_pct, good_fix_pct, sample_count, signal_gap_count)
    VALUES ('11111111-1111-4111-8111-111111111111','trip_x','x','aborted','traffic',0,0,now(),now(),NULL,0,0,0,0,0,0,0,0);
    RAISE EXCEPTION 'FAIL: client inserted an attempt directly';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: clients cannot write attempts';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points)
    VALUES ('11111111-1111-4111-8111-111111111111','trip_a1','top',999);
    RAISE EXCEPTION 'FAIL: client forged credit';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: clients cannot write credit';
  END;

  SELECT * INTO h FROM public.my_route_history('big-sur-coastal-crown');
  IF h.completed <> 1 OR h.aborted <> 1 OR h.best_ms <> 1200000 OR h.recent_ms <> ARRAY[1200000]::bigint[] THEN
    RAISE EXCEPTION 'FAIL: history wrong: %', h;
  END IF;
  RAISE NOTICE 'PASS: personal route history counts own completions and aborts';
END
$check$;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $check$
DECLARE h record; n integer;
BEGIN
  SELECT count(*) INTO n FROM public.route_run_credits;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: other member sees credit'; END IF;
  SELECT * INTO h FROM public.my_route_history('big-sur-coastal-crown');
  IF h.completed <> 0 OR h.aborted <> 1 OR h.best_ms IS NOT NULL THEN RAISE EXCEPTION 'FAIL: history leaked: %', h; END IF;
  RAISE NOTICE 'PASS: another member sees only their own history';
END
$check$;

ROLLBACK;
