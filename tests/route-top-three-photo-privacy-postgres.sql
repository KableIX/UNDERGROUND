-- Disposable checks for 20261127000003_route_top_three_and_photo_privacy.sql. Rolls back.
-- Run after applying all migrations through 20261127000003.
BEGIN;
INSERT INTO public.members (id, auth_user_id, member_number, display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','000101','STARK'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','000102','APEX'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','000103','NIGHTOWL'),
 ('44444444-4444-4444-8444-444444444444','dddddddd-dddd-4ddd-8ddd-dddddddddddd','000104','SLOWPOKE');
-- STARK has three finishes (best 700000); APEX ties NIGHTOWL but finished first.
INSERT INTO public.route_run_finishes (member_id, attempt_id, route_slug, duration_ms) VALUES
 ('11111111-1111-4111-8111-111111111111','s1','r',900000),
 ('11111111-1111-4111-8111-111111111111','s2','r',700000),
 ('11111111-1111-4111-8111-111111111111','s3','r',710000),
 ('22222222-2222-4222-8222-222222222222','a1','r',800000),
 ('33333333-3333-4333-8333-333333333333','n1','r',800000),
 ('44444444-4444-4444-8444-444444444444','p1','r',990000),
 ('44444444-4444-4444-8444-444444444444','p2','other',100000);
INSERT INTO public.route_run_attempts (member_id, attempt_id, route_slug, outcome, abort_reason, progress_m, progress_pct,
  started_at, ended_at, finished_at, distance_m, active_ms, moving_ms, stopped_ms, gps_coverage_pct, good_fix_pct, sample_count, signal_gap_count) VALUES
 ('22222222-2222-4222-8222-222222222222','a1','r','completed',NULL,1,100,now()-interval '2 days',now()-interval '2 days',now()-interval '2 days',1,1,1,0,99,99,1,0),
 ('33333333-3333-4333-8333-333333333333','n1','r','completed',NULL,1,100,now()-interval '1 day',now()-interval '1 day',now()-interval '1 day',1,1,1,0,99,99,1,0),
 ('11111111-1111-4111-8111-111111111111','s2','r','completed',NULL,1,100,now()-interval '3 days',now()-interval '3 days',now()-interval '3 days',1,1,1,0,99,99,1,0);

-- Photo location and storage paths are gone from the schema.
DO $check$
DECLARE cols text[];
BEGIN
  SELECT array_agg(column_name::text ORDER BY column_name) INTO cols FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'route_run_credits';
  IF cols && ARRAY['car_lat','car_lng','dash_lat','dash_lng','car_photo_path','dash_photo_path'] THEN
    RAISE EXCEPTION 'FAIL: photo location or path columns remain: %', cols;
  END IF;
  RAISE NOTICE 'PASS: no photo location or storage path columns';
  IF NOT cols @> ARRAY['tier','points','verified','car_status','dash_status','car_taken_at','dash_taken_at','updated_at'] THEN
    RAISE EXCEPTION 'FAIL: credit result columns missing: %', cols;
  END IF;
  RAISE NOTICE 'PASS: credit result kept (tier, points, verified, status, timestamps)';
END
$check$;

-- Service role (the API) writes credit results only.
SET LOCAL ROLE service_role;
INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_status, dash_status, car_taken_at, dash_taken_at, car_image_sha256, dash_image_sha256)
VALUES ('11111111-1111-4111-8111-111111111111','s2','top',30,'accepted','accepted',now(),now(),repeat('a',64),repeat('b',64));
DO $check$
DECLARE v boolean;
BEGIN
  SELECT verified INTO v FROM public.route_run_credits WHERE attempt_id = 's2';
  IF v IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: verified flag not derived from tier'; END IF;
  RAISE NOTICE 'PASS: verified flag derived from tier';
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_image_sha256)
    VALUES ('11111111-1111-4111-8111-111111111111','s3','car',20,repeat('a',64));
    RAISE EXCEPTION 'FAIL: same photo reused for another run';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: one photo cannot credit two runs';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_image_sha256, dash_image_sha256)
    VALUES ('11111111-1111-4111-8111-111111111111','s3','top',30,repeat('c',64),repeat('c',64));
    RAISE EXCEPTION 'FAIL: same photo used as car and dash';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: car and dash must be different photos';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_image_sha256)
    VALUES ('11111111-1111-4111-8111-111111111111','s3','car',20,'not-a-hash');
    RAISE EXCEPTION 'FAIL: malformed hash accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: image hash must be SHA-256 hex';
  END;
END
$check$;
RESET ROLE;

-- Anonymous callers get nothing.
SET LOCAL ROLE anon;
DO $check$
BEGIN
  BEGIN
    PERFORM * FROM public.route_all_time_top_three('r');
    RAISE EXCEPTION 'FAIL: anon read the top 3';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: top 3 not callable by anon';
  END;
END
$check$;
RESET ROLE;

-- Signed in, but not a member: empty.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', true);
DO $check$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public.route_all_time_top_three('r');
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: non-member saw % rows', n; END IF;
  RAISE NOTICE 'PASS: non-members see no top 3';
END
$check$;

-- A member (SLOWPOKE, not in the top 3) sees the board.
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', true);
DO $check$
DECLARE got text; cols text;
BEGIN
  SELECT string_agg(place || ':' || username || ':' || duration_ms, ',' ORDER BY place) INTO got
    FROM public.route_all_time_top_three('r');
  IF got IS DISTINCT FROM '1:STARK:700000,2:APEX:800000,3:NIGHTOWL:800000' THEN
    RAISE EXCEPTION 'FAIL: top 3 was %', got;
  END IF;
  RAISE NOTICE 'PASS: one best time per member, top 3 only, ties to the earlier finish';
  SELECT string_agg(attname, ',' ORDER BY attnum) INTO cols FROM (
    SELECT unnest(proargnames) AS attname, generate_subscripts(proargnames, 1) AS attnum
    FROM pg_proc WHERE oid = 'public.route_all_time_top_three(text)'::regprocedure) a WHERE attname <> 'target_route';
  IF cols IS DISTINCT FROM 'place,username,duration_ms' THEN RAISE EXCEPTION 'FAIL: top 3 returns %', cols; END IF;
  RAISE NOTICE 'PASS: top 3 returns only place, username and time';
  SELECT string_agg(username, ',') INTO got FROM public.route_all_time_top_three('other');
  IF got IS DISTINCT FROM 'SLOWPOKE' THEN RAISE EXCEPTION 'FAIL: routes mixed: %', got; END IF;
  RAISE NOTICE 'PASS: boards are per route';
  -- Everything else stays private.
  BEGIN
    PERFORM 1 FROM public.route_run_finishes WHERE member_id <> '44444444-4444-4444-8444-444444444444';
    IF FOUND THEN RAISE EXCEPTION 'FAIL: other members'' finishes readable'; END IF;
    RAISE NOTICE 'PASS: other members'' finishes stay private';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: other members'' finishes stay private (no table access)';
  END;
  PERFORM 1 FROM public.route_run_attempts WHERE member_id <> '44444444-4444-4444-8444-444444444444';
  IF FOUND THEN RAISE EXCEPTION 'FAIL: other members'' attempts readable'; END IF;
  RAISE NOTICE 'PASS: other members'' attempts stay private';
END
$check$;

-- Members still cannot read hashes or write credits.
DO $check$
BEGIN
  BEGIN
    PERFORM car_image_sha256 FROM public.route_run_credits;
    RAISE EXCEPTION 'FAIL: image hash readable by member';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: image hash hidden from clients';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points)
    VALUES ('44444444-4444-4444-8444-444444444444','p1','top',30);
    RAISE EXCEPTION 'FAIL: client wrote a credit';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: clients cannot write credits';
  END;
END
$check$;
ROLLBACK;
