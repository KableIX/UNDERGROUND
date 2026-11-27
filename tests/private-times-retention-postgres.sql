-- Disposable checks for 20261127000002_private_times_and_retention.sql. Rolls back.
BEGIN;
INSERT INTO public.members (id, auth_user_id, member_number, display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','000101','A'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','000102','B');
INSERT INTO public.districts (slug, name, region) VALUES ('d','D','test');
INSERT INTO public.territory_definitions (id, slug, name, district_slug, version, eligible_weight, geometry)
VALUES ('33333333-3333-4333-8333-333333333333','t','T','d',1,1,'SRID=4326;LINESTRING(-121.9 36.6,-121.8 36.7)');
INSERT INTO public.runs (id, member_id, territory_definition_id, evidence_source)
VALUES ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','simulation');
INSERT INTO public.run_gps_tracks (run_id, seq, recorded_at, geom, accuracy_m) VALUES
 ('44444444-4444-4444-8444-444444444444',0,now()-interval '120 days','SRID=4326;POINT(-121.9 36.6)',5),
 ('44444444-4444-4444-8444-444444444444',1,now()-interval '91 days','SRID=4326;POINT(-121.9 36.61)',5),
 ('44444444-4444-4444-8444-444444444444',2,now()-interval '10 days','SRID=4326;POINT(-121.9 36.62)',5);
INSERT INTO public.run_checkpoints (run_id, label, reached_at, geom) VALUES
 ('44444444-4444-4444-8444-444444444444','old',now()-interval '100 days','SRID=4326;POINT(-121.9 36.6)'),
 ('44444444-4444-4444-8444-444444444444','new',now()-interval '1 day','SRID=4326;POINT(-121.9 36.6)');
INSERT INTO public.route_run_attempts (member_id, attempt_id, route_slug, outcome, abort_reason, progress_m, progress_pct,
  started_at, ended_at, finished_at, distance_m, active_ms, moving_ms, stopped_ms, avg_speed_mps, avg_moving_speed_mps, max_speed_mps,
  gps_coverage_pct, good_fix_pct, sample_count, signal_gap_count) VALUES
 ('11111111-1111-4111-8111-111111111111','old','r','completed',NULL,12000,100,now()-interval '100 days',now()-interval '100 days',now()-interval '100 days',12000,900000,800000,100000,13.3,15,31,99,90,800,0),
 ('11111111-1111-4111-8111-111111111111','new','r','completed',NULL,12000,100,now()-interval '5 days',now()-interval '5 days',now()-interval '5 days',12000,880000,800000,80000,13.6,15,32,99,90,800,0);
INSERT INTO public.route_run_finishes (member_id, attempt_id, route_slug, duration_ms) VALUES
 ('11111111-1111-4111-8111-111111111111','new','r',880000),
 ('11111111-1111-4111-8111-111111111111','old','r',900000),
 ('22222222-2222-4222-8222-222222222222','b1','r',500000);

DO $check$
BEGIN
  IF to_regprocedure('public.route_top_three(text)') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: route_top_three still exists'; END IF;
  RAISE NOTICE 'PASS: route_top_three dropped';
  IF to_regclass('public.route_run_fastest') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: cross-member index remains'; END IF;
  RAISE NOTICE 'PASS: cross-member fastest index dropped';
END
$check$;

-- Members: personal bests are their own only; purge is not callable.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $check$
DECLARE n integer; others integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE attempt = 'b1') INTO n, others FROM public.my_run_top_threes();
  IF n <> 2 OR others <> 0 THEN RAISE EXCEPTION 'FAIL: personal bests leaked (% rows, % foreign)', n, others; END IF;
  RAISE NOTICE 'PASS: personal bests stay private';
  BEGIN
    PERFORM public.purge_raw_run_data();
    RAISE EXCEPTION 'FAIL: member ran the purge';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: purge is service-role only';
  END;
END
$check$;
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role', 'service_role', true);
DO $check$
DECLARE r record; a record; b record; n_tracks integer; n_cp integer;
BEGIN
  BEGIN
    PERFORM public.purge_raw_run_data(interval '1 hour');
    RAISE EXCEPTION 'FAIL: sub-day retention accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: retention below one day refused';
  END;
  SELECT * INTO r FROM public.purge_raw_run_data();
  IF r.gps_points <> 2 OR r.checkpoints <> 1 OR r.attempts_trimmed <> 1 THEN RAISE EXCEPTION 'FAIL: purge counts %', r; END IF;
  SELECT count(*) INTO n_tracks FROM public.run_gps_tracks;
  SELECT count(*) INTO n_cp FROM public.run_checkpoints;
  IF n_tracks <> 1 OR n_cp <> 1 THEN RAISE EXCEPTION 'FAIL: recent raw data removed'; END IF;
  RAISE NOTICE 'PASS: raw points older than 90 days purged, recent kept';
  SELECT * INTO a FROM public.route_run_attempts WHERE attempt_id = 'old';
  IF a.max_speed_mps IS NOT NULL OR a.avg_moving_speed_mps IS NOT NULL OR a.raw_purged_at IS NULL
     OR a.avg_speed_mps <> 13.3::real OR a.active_ms <> 900000 OR a.distance_m <> 12000 THEN
    RAISE EXCEPTION 'FAIL: old attempt not trimmed to summary: %', a;
  END IF;
  RAISE NOTICE 'PASS: old attempt keeps avg speed, completion time, distance only';
  SELECT * INTO b FROM public.route_run_attempts WHERE attempt_id = 'new';
  IF b.max_speed_mps IS NULL OR b.raw_purged_at IS NOT NULL THEN RAISE EXCEPTION 'FAIL: recent attempt trimmed'; END IF;
  RAISE NOTICE 'PASS: recent attempt untouched';
  IF NOT EXISTS (SELECT 1 FROM public.route_run_finishes WHERE attempt_id = 'old' AND duration_ms = 900000) THEN
    RAISE EXCEPTION 'FAIL: completion time lost';
  END IF;
  RAISE NOTICE 'PASS: finish times kept';
  SELECT * INTO r FROM public.purge_raw_run_data();
  IF r.gps_points <> 0 OR r.attempts_trimmed <> 0 THEN RAISE EXCEPTION 'FAIL: purge not idempotent'; END IF;
  RAISE NOTICE 'PASS: purge is idempotent';
END
$check$;
ROLLBACK;
