-- Disposable checks for 20261127000004_finish_nonce_and_app_attest.sql. Rolls back.
-- Run after applying all migrations through 20261127000004.
BEGIN;
INSERT INTO public.members (id, auth_user_id, member_number, display_name) VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','000101','STARK');
INSERT INTO public.route_run_finishes (member_id, attempt_id, route_slug, duration_ms) VALUES
 ('11111111-1111-4111-8111-111111111111','s1','r',700000),
 ('11111111-1111-4111-8111-111111111111','s2','r',710000);

SET LOCAL ROLE service_role;
INSERT INTO public.run_finish_nonce_uses (jti, member_id, attempt_id, route_slug)
VALUES ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','s1','r');
INSERT INTO public.device_attest_keys (key_id, member_id, platform, public_key_pem, environment)
VALUES ('S6KBQCC8D5WIHV1ZjZ6eSgRsntRdTwUvrIgXU/Ny0dA=','11111111-1111-4111-8111-111111111111','ios','-----BEGIN PUBLIC KEY-----x','development');
INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_status, dash_status, attested, nonce_jti)
VALUES ('11111111-1111-4111-8111-111111111111','s1','car',20,'accepted','library',true,'aaaaaaaa-0000-4000-8000-000000000001');

DO $check$
BEGIN
  RAISE NOTICE 'PASS: service role records nonce use, device key and attested credit with library status';
  BEGIN
    INSERT INTO public.run_finish_nonce_uses (jti, member_id, attempt_id, route_slug)
    VALUES ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','s2','r');
    RAISE EXCEPTION 'FAIL: nonce redeemed twice';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: a nonce is single-use';
  END;
  BEGIN
    INSERT INTO public.run_finish_nonce_uses (jti, member_id, attempt_id, route_slug)
    VALUES ('aaaaaaaa-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','s1','r');
    RAISE EXCEPTION 'FAIL: second nonce redeemed for the same attempt';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: one redeemed nonce per attempt';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, nonce_jti)
    VALUES ('11111111-1111-4111-8111-111111111111','s2','car',20,'aaaaaaaa-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'FAIL: one nonce credited two attempts';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: one nonce per credit';
  END;
  BEGIN
    INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_status)
    VALUES ('11111111-1111-4111-8111-111111111111','s2','none',0,'bogus');
    RAISE EXCEPTION 'FAIL: unknown photo status accepted';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: photo status limited to known values';
  END;
  INSERT INTO public.route_run_credits (member_id, attempt_id, tier, points, car_status)
  VALUES ('11111111-1111-4111-8111-111111111111','s2','none',0,'unverified');
  RAISE NOTICE 'PASS: unverified status stored with no credit';
  BEGIN
    INSERT INTO public.device_attest_keys (key_id, member_id, platform, public_key_pem, environment)
    VALUES ('S6KBQCC8D5WIHV1ZjZ6eSgRsntRdTwUvrIgXU/Ny0dA=','11111111-1111-4111-8111-111111111111','ios','x','development');
    RAISE EXCEPTION 'FAIL: device key registered twice';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: a device key registers once';
  END;
END
$check$;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $check$
DECLARE a boolean;
BEGIN
  BEGIN
    PERFORM 1 FROM public.device_attest_keys;
    RAISE EXCEPTION 'FAIL: member read device keys';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: device keys hidden from clients';
  END;
  BEGIN
    PERFORM 1 FROM public.run_finish_nonce_uses;
    RAISE EXCEPTION 'FAIL: member read nonce uses';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: nonce uses hidden from clients';
  END;
  BEGIN
    INSERT INTO public.run_finish_nonce_uses (jti, member_id, attempt_id, route_slug)
    VALUES ('aaaaaaaa-0000-4000-8000-000000000009','11111111-1111-4111-8111-111111111111','s9','r');
    RAISE EXCEPTION 'FAIL: client redeemed a nonce';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: clients cannot redeem nonces';
  END;
  SELECT attested INTO a FROM public.route_run_credits WHERE attempt_id = 's1';
  IF a IS NOT TRUE THEN RAISE EXCEPTION 'FAIL: own attested flag unreadable'; END IF;
  RAISE NOTICE 'PASS: member reads own attested flag';
  BEGIN
    PERFORM nonce_jti FROM public.route_run_credits;
    RAISE EXCEPTION 'FAIL: nonce id readable by member';
  EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: nonce id hidden from clients';
  END;
END
$check$;
ROLLBACK;
