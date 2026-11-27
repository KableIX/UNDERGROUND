-- Disposable checks for 20261127000010_supercargo.sql (Supabase auth emulated).
-- Run against a throwaway Postgres+PostGIS with every migration applied. Rolls back.
-- Never run against a shared or production database.
\set ON_ERROR_STOP 1
BEGIN;
GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
GRANT SELECT ON public.members, public.vehicles TO authenticated;

INSERT INTO public.members (id, auth_user_id, member_number, display_name, created_at) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','000101','A', now()-interval '90 days'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','000102','B', now()-interval '90 days'),
 ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc','000103','C', now());
INSERT INTO public.vehicles (id, owner_member_id, year, make, model, color) VALUES
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',2015,'Porsche','918 Spyder','Silver'),
 ('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',2017,'Ford','GT','Blue');

INSERT INTO public.supercargo_catalog (id, make, model, built, built_source, first_year, tier, score) VALUES
 ('porsche-918-spyder','Porsche','918 Spyder',918,'Porsche: 918 units',2013,'numbered',40),
 ('ferrari-laferrari','Ferrari','LaFerrari',499,'Ferrari: 499 coupes',2013,'allocated',50),
 ('one-off','Coachbuilt','One-off',1,'Maker',2020,'singular',100);
INSERT INTO public.supercargo_settings (member_id, enabled, credit_public) VALUES
 ('11111111-1111-4111-8111-111111111111', true, false),
 ('22222222-2222-4222-8222-222222222222', true, true);

-- B: one public sighting past its hold, one still on hold, one private. A: one private.
INSERT INTO public.supercargo_sightings (id, spotter, catalog_id, make, model, tier, source, credited, visibility, redaction,
  captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng, photo_path) VALUES
 ('a0000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','ferrari-laferrari','Ferrari','LaFerrari','allocated','camera',true,'public','done',
   now()-interval '20 hours', now()-interval '8 hours', now()+interval '52 hours','c0.02:1866:-5000',37.33,-121.89,'supercargo/redacted/bbbb/00000001.jpg'),
 ('a0000000-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','porsche-918-spyder','Porsche','918 Spyder','numbered','camera',true,'public','done',
   now()-interval '1 hour', now()+interval '11 hours', now()+interval '71 hours','c0.02:1866:-5000',37.33,-121.89,'supercargo/redacted/bbbb/00000002.jpg'),
 ('a0000000-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222',NULL,'Audi','R8','open','library',false,'private','pending',
   now()-interval '1 hour', now()+interval '5 hours', now()+interval '71 hours','c0.02:1866:-5000',37.33,-121.89,NULL),
 ('a0000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','porsche-918-spyder','Porsche','918 Spyder','numbered','camera',true,'private','done',
   now()-interval '30 hours', now()-interval '18 hours', now()+interval '42 hours','c0.02:1866:-5000',37.33,-121.89,NULL);
INSERT INTO public.supercargo_sighting_points (sighting_id, point, accuracy_m) VALUES
 ('a0000000-0000-4000-8000-000000000001', ST_SetSRID(ST_MakePoint(-121.8863,37.3318),4326)::geography, 8);
INSERT INTO public.supercargo_ledger (id, member_id, catalog_id, origin, sighting_id) VALUES
 ('f0000000-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','porsche-918-spyder','sighting','a0000000-0000-4000-8000-000000000004');

INSERT INTO public.supercargo_anchors (id, name, kind, point, reviewed_public) VALUES
 ('skyline-vista','Skyline vista point','overlook', ST_SetSRID(ST_MakePoint(-122.2000,37.3000),4326)::geography, true);
INSERT INTO public.supercargo_envelopes (id, anchor_id, catalog_id, opens_at, closes_at, stock) VALUES
 ('e0000000-0000-4000-8000-000000000001','skyline-vista','ferrari-laferrari', now()-interval '1 hour', now()+interval '23 hours', 2);
-- Aged envelope folios for the Exchange.
INSERT INTO public.supercargo_envelopes (id, anchor_id, catalog_id, opens_at, closes_at, stock, claimed) VALUES
 ('e0000000-0000-4000-8000-000000000002','skyline-vista','porsche-918-spyder', now()-interval '5 days', now()-interval '4 days', 5, 3);
INSERT INTO public.supercargo_ledger (id, member_id, catalog_id, origin, envelope_id, acquired_at) VALUES
 ('f0000000-0000-4000-8000-0000000000a1','11111111-1111-4111-8111-111111111111','porsche-918-spyder','envelope','e0000000-0000-4000-8000-000000000002', now()-interval '4 days'),
 ('f0000000-0000-4000-8000-0000000000b1','22222222-2222-4222-8222-222222222222','ferrari-laferrari','envelope','e0000000-0000-4000-8000-000000000002', now()-interval '4 days'),
 ('f0000000-0000-4000-8000-0000000000b2','22222222-2222-4222-8222-222222222222','one-off','envelope','e0000000-0000-4000-8000-000000000002', now()-interval '4 days'),
 ('f0000000-0000-4000-8000-0000000000c1','33333333-3333-4333-8333-333333333333','porsche-918-spyder','envelope','e0000000-0000-4000-8000-000000000002', now()-interval '2 days');

-- Schema-level guards (as owner).
DO $check$
BEGIN
  BEGIN
    INSERT INTO public.supercargo_sightings (spotter, make, model, source, credited, visibility, redaction, captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng)
    VALUES ('22222222-2222-4222-8222-222222222222','X','Y','camera',true,'public','pending', now(), now()+interval '6 hours', now()+interval '72 hours','c',0,0);
    RAISE EXCEPTION 'FAIL: public sighting without redaction accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: public needs a redacted photo';
  END;
  BEGIN
    INSERT INTO public.supercargo_sightings (spotter, make, model, source, credited, captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng)
    VALUES ('22222222-2222-4222-8222-222222222222','X','Y','camera',false, now(), now()+interval '1 hour', now()+interval '72 hours','c',0,0);
    RAISE EXCEPTION 'FAIL: hold shorter than six hours accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: six-hour minimum hold enforced';
  END;
  BEGIN
    INSERT INTO public.supercargo_sightings (spotter, make, model, source, credited, captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng)
    VALUES ('22222222-2222-4222-8222-222222222222','X','Y','library',true, now(), now()+interval '6 hours', now()+interval '72 hours','c',0,0);
    RAISE EXCEPTION 'FAIL: credited library photo accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: library photos earn no credit';
  END;
  BEGIN
    INSERT INTO public.supercargo_sightings (spotter, make, model, source, credited, captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng)
    VALUES ('22222222-2222-4222-8222-222222222222','X','Y','camera',false, now(), now()+interval '6 hours', now()+interval '96 hours','c',0,0);
    RAISE EXCEPTION 'FAIL: window longer than 72 hours accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: 72-hour window enforced';
  END;
  BEGIN
    INSERT INTO public.supercargo_ledger (member_id, catalog_id, origin, sighting_id)
    VALUES ('11111111-1111-4111-8111-111111111111','ferrari-laferrari','sighting','a0000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FAIL: folio for someone else''s sighting accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: sighting folios belong to the spotter';
  END;
  BEGIN
    UPDATE public.supercargo_ledger SET member_id = '22222222-2222-4222-8222-222222222222' WHERE id = 'f0000000-0000-4000-8000-000000000004';
    RAISE EXCEPTION 'FAIL: sighting folio changed hands';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: sighting folios do not change hands';
  END;
  BEGIN
    INSERT INTO public.supercargo_catalog (id, make, model, tier) VALUES ('unsourced','X','Y','atelier');
    RAISE EXCEPTION 'FAIL: unsourced tier accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: tier above Open needs a sourced number';
  END;
  BEGIN
    INSERT INTO public.supercargo_anchors (id, name, kind, point, reviewed_public) VALUES ('home','Someone''s street','venue', ST_SetSRID(ST_MakePoint(0,0),4326)::geography, false);
    RAISE EXCEPTION 'FAIL: unreviewed anchor accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: anchors must be reviewed public places';
  END;
END
$check$;

-- Service role: envelope claims.
SET LOCAL ROLE service_role;
DO $check$
DECLARE r text;
BEGIN
  r := public.supercargo_claim_envelope('11111111-1111-4111-8111-111111111111','e0000000-0000-4000-8000-000000000001',-122.2100,37.3000,10);
  IF r <> 'too_far' THEN RAISE EXCEPTION 'FAIL: far claim returned %', r; END IF;
  r := public.supercargo_claim_envelope('11111111-1111-4111-8111-111111111111','e0000000-0000-4000-8000-000000000001',-122.2000,37.3002,90);
  IF r <> 'weak_fix' THEN RAISE EXCEPTION 'FAIL: weak fix returned %', r; END IF;
  r := public.supercargo_claim_envelope('11111111-1111-4111-8111-111111111111','e0000000-0000-4000-8000-000000000001',-122.2000,37.3002,10);
  IF r <> 'claimed' THEN RAISE EXCEPTION 'FAIL: near claim returned %', r; END IF;
  r := public.supercargo_claim_envelope('11111111-1111-4111-8111-111111111111','e0000000-0000-4000-8000-000000000001',-122.2000,37.3002,10);
  IF r <> 'already' THEN RAISE EXCEPTION 'FAIL: second claim returned %', r; END IF;
  RAISE NOTICE 'PASS: envelope claims need presence within 60 m, once per member';
END
$check$;
RESET ROLE;

-- Member A.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $check$
DECLARE n integer; num text; r text;
BEGIN
  SELECT count(*) INTO n FROM public.supercargo_sightings;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: A sees % sighting rows, expected only own', n; END IF;
  RAISE NOTICE 'PASS: the sightings table shows a member only their own rows';

  SELECT count(*), max(spotter_number) INTO n, num FROM public.supercargo_map(-180,-90,180,90);
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: map returned % rows, expected the one past its hold', n; END IF;
  IF num IS DISTINCT FROM '000102' THEN RAISE EXCEPTION 'FAIL: credit_public spotter number missing'; END IF;
  RAISE NOTICE 'PASS: map shows only published sightings past their hold, as cells';

  BEGIN
    PERFORM 1 FROM public.supercargo_sighting_points;
    RAISE EXCEPTION 'FAIL: precise points readable by a member';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: precise points are service-only';
  END;
  BEGIN
    INSERT INTO public.supercargo_sightings (spotter, make, model, source, captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng)
    VALUES ('11111111-1111-4111-8111-111111111111','X','Y','camera', now(), now()+interval '6 hours', now()+interval '72 hours','c',0,0);
    RAISE EXCEPTION 'FAIL: member wrote a sighting directly';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: sightings are written by the API only';
  END;
  BEGIN
    PERFORM public.supercargo_claim_envelope('11111111-1111-4111-8111-111111111111','e0000000-0000-4000-8000-000000000001',-122.2,37.3,5);
    RAISE EXCEPTION 'FAIL: member called the claim function directly';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: claims go through the API';
  END;
  BEGIN
    PERFORM 1 FROM public.supercargo_envelopes;
    RAISE EXCEPTION 'FAIL: envelope contents readable';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: envelope contents stay sealed';
  END;

  SELECT count(*) INTO n FROM public.supercargo_ledger;
  IF n <> 3 THEN RAISE EXCEPTION 'FAIL: A ledger has % folios, expected 3', n; END IF;
  RAISE NOTICE 'PASS: the Ledger shows a member only their own folios';

  BEGIN
    PERFORM public.supercargo_propose_exchange('22222222-2222-4222-8222-222222222222',
      ARRAY['f0000000-0000-4000-8000-000000000004']::uuid[], ARRAY['f0000000-0000-4000-8000-0000000000b1']::uuid[]);
    RAISE EXCEPTION 'FAIL: sighting folio offered';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: sighting folios stay out of the Exchange';
  END;
  BEGIN
    PERFORM public.supercargo_propose_exchange('22222222-2222-4222-8222-222222222222',
      ARRAY(SELECT id FROM public.supercargo_ledger WHERE envelope_id='e0000000-0000-4000-8000-000000000001'), ARRAY['f0000000-0000-4000-8000-0000000000b1']::uuid[]);
    RAISE EXCEPTION 'FAIL: fresh folio offered';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: folios settle 24 hours before trading';
  END;
  BEGIN
    PERFORM public.supercargo_propose_exchange('33333333-3333-4333-8333-333333333333',
      ARRAY['f0000000-0000-4000-8000-0000000000a1']::uuid[], ARRAY['f0000000-0000-4000-8000-0000000000c1']::uuid[]);
    RAISE NOTICE 'PASS: ordinary exchange with a new member allowed';
  END;

  -- Reports: safety reason holds a public sighting at once; private sightings cannot be reported by others.
  INSERT INTO public.supercargo_reports (sighting_id, reason) VALUES ('a0000000-0000-4000-8000-000000000001','plate_visible');
  SELECT count(*) INTO n FROM public.supercargo_map(-180,-90,180,90);
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: reported sighting still on the map'; END IF;
  RAISE NOTICE 'PASS: one safety report takes a sighting off the map';
  BEGIN
    INSERT INTO public.supercargo_reports (sighting_id, reason) VALUES ('a0000000-0000-4000-8000-000000000003','spam');
    RAISE EXCEPTION 'FAIL: reported a private sighting of another member';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: private sightings are invisible to reports';
  END;

  INSERT INTO public.supercargo_optouts (vehicle_id) VALUES ('44444444-4444-4444-8444-444444444444');
  BEGIN
    INSERT INTO public.supercargo_optouts (vehicle_id) VALUES ('55555555-5555-4555-8555-555555555555');
    RAISE EXCEPTION 'FAIL: opted out a car A does not own';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: owners opt out only their own cars';
  END;
  INSERT INTO public.supercargo_home_zones (zone) VALUES (ST_SetSRID(ST_MakePoint(-121.9,37.3),4326)::geography);
  RAISE NOTICE 'PASS: member stored a private home zone';
END
$check$;

-- Member B: cannot read A's home zone; accepts nothing addressed elsewhere; proposes to C a singular (C is new).
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
DO $check$
DECLARE n integer; x uuid; r text;
BEGIN
  SELECT count(*) INTO n FROM public.supercargo_home_zones;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B reads A home zone'; END IF;
  RAISE NOTICE 'PASS: home zones are private';
  SELECT count(*) INTO n FROM public.supercargo_exchanges;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B sees an exchange between A and C'; END IF;
  RAISE NOTICE 'PASS: exchanges are visible only to their parties';
  BEGIN
    PERFORM public.supercargo_propose_exchange('33333333-3333-4333-8333-333333333333',
      ARRAY['f0000000-0000-4000-8000-0000000000b2']::uuid[], ARRAY['f0000000-0000-4000-8000-0000000000c1']::uuid[]);
    RAISE EXCEPTION 'FAIL: Singular traded to a member under 30 days';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: Singular folios need 30 days of tenure on both sides';
  END;
  SELECT count(*) INTO n FROM public.supercargo_reports;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: B sees who reported'; END IF;
  RAISE NOTICE 'PASS: reporters stay anonymous to the spotter';
END
$check$;

-- Member C accepts A's offer: the swap is atomic.
SELECT set_config('request.jwt.claim.sub','cccccccc-cccc-4ccc-8ccc-cccccccccccc',true);
DO $check$
DECLARE x uuid; r text; owner uuid;
BEGIN
  SELECT id INTO x FROM public.supercargo_exchanges WHERE status = 'open';
  r := public.supercargo_decide_exchange(x, true);
  IF r <> 'accepted' THEN RAISE EXCEPTION 'FAIL: accept returned %', r; END IF;
  SELECT member_id INTO owner FROM public.supercargo_ledger WHERE id = 'f0000000-0000-4000-8000-0000000000a1';
  IF owner <> '33333333-3333-4333-8333-333333333333' THEN RAISE EXCEPTION 'FAIL: folio did not move'; END IF;
  RAISE NOTICE 'PASS: accepted exchange swaps folios atomically';
END
$check$;

-- Service role: privacy flags (home zone, own car, opt-out).
RESET ROLE;
SET LOCAL ROLE service_role;
DO $check$
DECLARE f record;
BEGIN
  SELECT * INTO f FROM public.supercargo_privacy_flags('22222222-2222-4222-8222-222222222222','Porsche','918 Spyder',-121.9005,37.3003);
  IF NOT f.near_home THEN RAISE EXCEPTION 'FAIL: home zone not detected'; END IF;
  IF NOT f.opted_out THEN RAISE EXCEPTION 'FAIL: opted-out car not detected'; END IF;
  IF f.own_car THEN RAISE EXCEPTION 'FAIL: B flagged as owning A''s car'; END IF;
  SELECT * INTO f FROM public.supercargo_privacy_flags('11111111-1111-4111-8111-111111111111','porsche','918 spyder',-122.4,37.8);
  IF NOT f.own_car OR f.near_home THEN RAISE EXCEPTION 'FAIL: own car / far point flags wrong'; END IF;
  RAISE NOTICE 'PASS: privacy flags catch home zones, own cars and opt-outs';
END
$check$;
RESET ROLE;

-- Anonymous callers get nothing.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $check$
BEGIN
  BEGIN
    PERFORM 1 FROM public.supercargo_map(-180,-90,180,90);
    RAISE EXCEPTION 'FAIL: anon read the map';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: the map is members-only';
  END;
END
$check$;
-- ---- Curated meets, featured cars, envelope stocking, commissions, clubs, hashes, purge ----
RESET ROLE;
UPDATE public.members SET role = 'admin' WHERE id = '11111111-1111-4111-8111-111111111111';
INSERT INTO public.supercargo_anchors (id, name, kind, point, reviewed_public) VALUES
 ('coffee-lot','Saturday coffee lot','curated_meet', ST_SetSRID(ST_MakePoint(-121.95,37.40),4326)::geography, true);
INSERT INTO public.clubs (id, slug, name, founding_market, created_by_member_id) VALUES
 ('c1111111-1111-4111-8111-111111111111','north-coast','North Coast','california','11111111-1111-4111-8111-111111111111'),
 ('c2222222-2222-4222-8222-222222222222','elsewhere','Elsewhere','california','33333333-3333-4333-8333-333333333333');
INSERT INTO public.club_memberships (club_id, member_id) VALUES
 ('c1111111-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111'),
 ('c1111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'),
 ('c2222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333');
INSERT INTO public.supercargo_commissions (id, week_start, title, rule, target) VALUES
 ('wk-numbered', (date_trunc('week', now() AT TIME ZONE 'UTC'))::date, 'One Numbered or rarer', '{"kind":"sightings","minTier":"numbered"}', 1),
 ('wk-envelope', (date_trunc('week', now() AT TIME ZONE 'UTC'))::date, 'One envelope', '{"kind":"envelopes"}', 1),
 ('wk-makes',    (date_trunc('week', now() AT TIME ZONE 'UTC'))::date, 'Five marques', '{"kind":"distinct_makes"}', 5);
-- A credited Numbered sighting by B this week.
INSERT INTO public.supercargo_sightings (spotter, catalog_id, make, model, tier, source, credited, visibility, redaction,
  captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng)
VALUES ('22222222-2222-4222-8222-222222222222','porsche-918-spyder','Porsche','918 Spyder','numbered','camera',true,'private','failed',
  greatest(now() - interval '1 minute', (date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 minute'),
  greatest(now() - interval '1 minute', (date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 minute') + interval '6 hours',
  greatest(now() - interval '1 minute', (date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') + interval '1 minute') + interval '72 hours',
  'c0.02:1:1', 37.33, -121.89);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $check$
BEGIN
  INSERT INTO public.supercargo_meets (id, anchor_id, name, starts_at, ends_at)
  VALUES ('d0000000-0000-4000-8000-000000000001','coffee-lot','Saturday coffee', now() - interval '1 hour', now() + interval '2 hours');
  BEGIN
    INSERT INTO public.supercargo_meets (anchor_id, name, starts_at, ends_at)
    VALUES ('skyline-vista','Not a meet place', now(), now() + interval '1 hour');
    RAISE EXCEPTION 'FAIL: meet on a non-meet anchor';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: meets only at reviewed curated-meet places';
  END;
  INSERT INTO public.supercargo_featured (week_start, catalog_id, note)
  VALUES ((date_trunc('week', now() AT TIME ZONE 'UTC'))::date, 'one-off', 'This week');
  RAISE NOTICE 'PASS: an admin sets the featured car';
END
$check$;
SELECT set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
DO $check$
DECLARE r record; n integer;
BEGIN
  BEGIN
    INSERT INTO public.supercargo_featured (week_start, catalog_id) VALUES ((date_trunc('week', now() AT TIME ZONE 'UTC'))::date + 7, 'one-off');
    RAISE EXCEPTION 'FAIL: non-admin set the featured car';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: only admins set the featured car';
  END;
  BEGIN
    INSERT INTO public.supercargo_meets (anchor_id, name, starts_at, ends_at) VALUES ('coffee-lot','Mine', now(), now() + interval '1 hour');
    RAISE EXCEPTION 'FAIL: non-admin created a meet';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: only admins create meets';
  END;
  SELECT * INTO r FROM public.supercargo_my_commissions() WHERE commission_id = 'wk-numbered';
  IF r.have <> 1 OR r.need <> 1 THEN RAISE EXCEPTION 'FAIL: live commission progress % of %', r.have, r.need; END IF;
  SELECT * INTO r FROM public.supercargo_my_commissions() WHERE commission_id = 'wk-makes';
  IF r.have NOT BETWEEN 1 AND 4 OR r.need <> 5 THEN RAISE EXCEPTION 'FAIL: distinct makes % of %', r.have, r.need; END IF;
  RAISE NOTICE 'PASS: commissions are live from the database';
  BEGIN
    PERFORM public.supercargo_settle_marks(current_date);
    RAISE EXCEPTION 'FAIL: member settled marks';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: marks are settled by the service only';
  END;
END
$check$;

RESET ROLE;
SET LOCAL ROLE service_role;
DO $check$
DECLARE n integer; m uuid; f integer; o integer; s integer;
BEGIN
  m := public.supercargo_meet_at(-121.9503, 37.4002, now());
  IF m IS DISTINCT FROM 'd0000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'FAIL: meet not found at the lot'; END IF;
  IF public.supercargo_meet_at(-121.96, 37.40, now()) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: meet matched 900 m away'; END IF;
  IF public.supercargo_meet_at(-121.9503, 37.4002, now() + interval '5 hours') IS NOT NULL THEN RAISE EXCEPTION 'FAIL: meet matched after it ended'; END IF;
  INSERT INTO public.supercargo_sightings (spotter, make, model, tier, source, credited, visibility, redaction, captured_at, publish_at, expires_at,
    cell_id, cell_lat, cell_lng, meet_id)
  VALUES ('22222222-2222-4222-8222-222222222222','Ferrari','F40','numbered','camera',true,'private','failed', now(), now() + interval '1 hour',
    now() + interval '72 hours','c', 37.4, -121.95, m);
  BEGIN
    INSERT INTO public.supercargo_sightings (spotter, make, model, tier, source, credited, captured_at, publish_at, expires_at, cell_id, cell_lat, cell_lng, meet_id)
    VALUES ('22222222-2222-4222-8222-222222222222','Ferrari','F40','numbered','camera',true, now() + interval '5 hours', now() + interval '6 hours',
      now() + interval '72 hours','c', 37.4, -121.95, m);
    RAISE EXCEPTION 'FAIL: meet hold used outside the meet';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: one-hour hold only inside a live curated meet';
  END;
  RAISE NOTICE 'PASS: curated meets match by place and time';

  PERFORM setseed(0.42);
  PERFORM public.supercargo_stock_envelopes('skyline-vista', now(), now() + interval '1 day', 50, 1::smallint);
  PERFORM public.supercargo_stock_envelopes('skyline-vista', now(), now() + interval '1 day', 50, 1::smallint);
  PERFORM public.supercargo_stock_envelopes('skyline-vista', now(), now() + interval '1 day', 50, 1::smallint);
  PERFORM public.supercargo_stock_envelopes('skyline-vista', now(), now() + interval '1 day', 50, 1::smallint);
  SELECT count(*) FILTER (WHERE catalog_id = 'one-off'), count(*) FILTER (WHERE catalog_id = 'porsche-918-spyder'),
         count(*) FILTER (WHERE catalog_id = 'ferrari-laferrari')
    INTO f, o, s FROM public.supercargo_envelopes WHERE opens_at > now() - interval '1 minute';
  IF f < 5 OR o <= s THEN RAISE EXCEPTION 'FAIL: envelope draw featured=% numbered=% allocated=%', f, o, s; END IF;
  RAISE NOTICE 'PASS: envelopes drawn by rarity with the featured car (featured %, numbered %, allocated % of 200)', f, o, s;

  n := public.supercargo_settle_marks((date_trunc('week', now() AT TIME ZONE 'UTC'))::date);
  IF n < 1 THEN RAISE EXCEPTION 'FAIL: no marks settled'; END IF;
  IF public.supercargo_settle_marks((date_trunc('week', now() AT TIME ZONE 'UTC'))::date) <> 0 THEN RAISE EXCEPTION 'FAIL: settle not idempotent'; END IF;
  RAISE NOTICE 'PASS: completed commissions become marks, once';

  INSERT INTO public.supercargo_image_hashes (sha256, dhash, member_id)
  VALUES (repeat('a', 64), 1234567890123, '22222222-2222-4222-8222-222222222222');
  IF NOT public.supercargo_image_seen(repeat('a', 64), NULL) THEN RAISE EXCEPTION 'FAIL: exact duplicate missed'; END IF;
  IF NOT public.supercargo_image_seen(repeat('b', 64), 1234567890123 # 5) THEN RAISE EXCEPTION 'FAIL: near duplicate missed'; END IF;
  IF public.supercargo_image_seen(repeat('b', 64), ~1234567890123) THEN RAISE EXCEPTION 'FAIL: different photo flagged'; END IF;
  RAISE NOTICE 'PASS: duplicate photos are caught by exact and near hashes';

  UPDATE public.supercargo_sighting_points SET purge_after = now() - interval '1 second';
  UPDATE public.supercargo_image_hashes SET purge_after = now() - interval '1 second';
  n := public.supercargo_purge();
  IF n < 2 OR EXISTS (SELECT 1 FROM public.supercargo_sighting_points) THEN RAISE EXCEPTION 'FAIL: purge left % rows', n; END IF;
  RAISE NOTICE 'PASS: purge removes expired precise points and fingerprints';
END
$check$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
DO $check$
DECLARE r record; n integer;
BEGIN
  SELECT count(*) INTO n FROM public.supercargo_my_club_marks();
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: A sees % clubs', n; END IF;
  SELECT * INTO r FROM public.supercargo_my_club_marks();
  IF r.club_name <> 'North Coast' OR r.members <> 2 OR r.marks_this_week < 1 THEN RAISE EXCEPTION 'FAIL: club totals %', r; END IF;
  RAISE NOTICE 'PASS: a club sees its combined marks, as totals';
  BEGIN
    PERFORM 1 FROM public.supercargo_marks WHERE member_id = '22222222-2222-4222-8222-222222222222';
    IF FOUND THEN RAISE EXCEPTION 'FAIL: A reads B marks'; END IF;
    RAISE NOTICE 'PASS: individual marks stay private, so no member is ranked';
  END;
  SELECT count(*) INTO n FROM public.supercargo_tradeable_folios('000102');
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: B tradeable folios %', n; END IF;
  SELECT count(*) INTO n FROM public.supercargo_my_exchanges();
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: A exchanges %', n; END IF;
  RAISE NOTICE 'PASS: the Exchange lists tradeable folios and my offers';
  BEGIN
    PERFORM public.supercargo_image_seen(repeat('a', 64), NULL);
    RAISE EXCEPTION 'FAIL: member queried fingerprints';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: photo fingerprints are service-only';
  END;
END
$check$;
ROLLBACK;
