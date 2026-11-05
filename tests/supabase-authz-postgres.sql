-- Disposable PostgreSQL+Supabase-auth-emulation authorization checks.
-- Requires migrations 00001..00009, auth.uid()/auth.role() and authenticated role.
-- Transaction rolls back all fixtures and test grants.
BEGIN;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public, auth TO authenticated;

INSERT INTO public.members (id, auth_user_id, member_number, display_name)
VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','000101','A'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','000102','B');
INSERT INTO public.profiles (member_id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $check$
BEGIN
  BEGIN
    INSERT INTO public.vehicles (id, owner_member_id, year, make, model, color, verification_status)
    VALUES ('44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111', 2010, 'Audi', 'R8', 'Black', 'verified');
    RAISE EXCEPTION 'FAIL: client self-verification on insert succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: verified insert blocked';
  END;
END
$check$;

INSERT INTO public.vehicles (id, owner_member_id, year, make, model, color)
VALUES ('44444444-4444-4444-8444-444444444444',
 '11111111-1111-4111-8111-111111111111', 2010, 'Audi', 'R8', 'Black');

DO $check$
BEGIN
  BEGIN
    UPDATE public.vehicles SET verification_status = 'verified'
    WHERE id = '44444444-4444-4444-8444-444444444444';
    RAISE EXCEPTION 'FAIL: client self-verification on update succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: verified update blocked';
  END;
  BEGIN
    INSERT INTO public.vehicle_media (vehicle_id, storage_path, is_placeholder, caption)
    VALUES ('44444444-4444-4444-8444-444444444444',
      'garage/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/44444444-4444-4444-8444-444444444444/forged.jpg',
      false, 'Forgeries must not enter the verified garage');
    RAISE EXCEPTION 'FAIL: direct client media insertion succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: direct client media insertion blocked';
  END;
  BEGIN
    UPDATE public.profiles SET friend_count = 999
    WHERE member_id = '11111111-1111-4111-8111-111111111111';
    RAISE EXCEPTION 'FAIL: social count forgery succeeded';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: social counter forgery blocked';
  END;
  BEGIN
    INSERT INTO public.friendships (id, requester_id, addressee_id, status)
    VALUES ('55555555-5555-4555-8555-555555555555',
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222',
     'accepted');
    RAISE EXCEPTION 'FAIL: client accepted friendship inserted';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: accepted friendship insert blocked';
  END;
END
$check$;

INSERT INTO public.friendships (id, requester_id, addressee_id)
VALUES ('55555555-5555-4555-8555-555555555555',
 '11111111-1111-4111-8111-111111111111',
 '22222222-2222-4222-8222-222222222222');

DO $check$
DECLARE changed_count integer;
BEGIN
  UPDATE public.friendships SET status = 'accepted'
  WHERE id = '55555555-5555-4555-8555-555555555555';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: requester accepted own friendship';
  END IF;
  RAISE NOTICE 'PASS: requester cannot accept own friendship';
END
$check$;

SELECT set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $check$
DECLARE changed_count integer;
BEGIN
  UPDATE public.friendships SET status = 'accepted'
  WHERE id = '55555555-5555-4555-8555-555555555555';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: recipient could not accept';
  END IF;
  RAISE NOTICE 'PASS: recipient accepts';
  BEGIN
    UPDATE public.friendships SET status = 'rejected'
    WHERE id = '55555555-5555-4555-8555-555555555555';
    RAISE EXCEPTION 'FAIL: accepted friendship was mutated again';
  EXCEPTION WHEN SQLSTATE '42501' THEN
    RAISE NOTICE 'PASS: repeated transition blocked';
  END;
END
$check$;
ROLLBACK;
