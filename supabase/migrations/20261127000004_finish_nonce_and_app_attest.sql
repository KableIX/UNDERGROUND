-- Anti-cheat for finish photo proofs (TJ, 2026-11-27).
--
-- 1. Finish nonce redemptions. POST /v1/route-finishes issues a short-lived HMAC-signed nonce
--    bound to member, attempt and route when it accepts a Run's GPS finish. A photo proof must
--    carry it; redeeming it records the nonce id here once (single use).
-- 2. App Attest device keys. One attested key per device and member, registered once with
--    Apple's attestation, then used to verify assertions signed over each proof payload.
-- 3. Credit statuses 'library' (photo not taken with the in-app camera: earns nothing) and
--    'unverified' (nonce or attestation failed: earns nothing), plus the attested flag.
-- Service role (services/api) only. No client access. Photos still never reach the server.
BEGIN;

CREATE TABLE public.run_finish_nonce_uses (
  jti uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  attempt_id text NOT NULL CHECK (attempt_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  route_slug text NOT NULL CHECK (char_length(route_slug) BETWEEN 1 AND 120),
  used_at timestamptz NOT NULL DEFAULT now()
);
-- One redeemed nonce per attempt.
CREATE UNIQUE INDEX run_finish_nonce_uses_attempt ON public.run_finish_nonce_uses(member_id, attempt_id);

CREATE TABLE public.device_attest_keys (
  key_id text PRIMARY KEY CHECK (char_length(key_id) BETWEEN 1 AND 100),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  public_key_pem text NOT NULL CHECK (char_length(public_key_pem) < 1000),
  environment text NOT NULL CHECK (environment IN ('production', 'development')),
  sign_count bigint NOT NULL DEFAULT 0 CHECK (sign_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX device_attest_keys_member ON public.device_attest_keys(member_id);

ALTER TABLE public.run_finish_nonce_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_attest_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.run_finish_nonce_uses, public.device_attest_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.run_finish_nonce_uses, public.device_attest_keys TO service_role;

-- Credit result gains the proof outcome.
ALTER TABLE public.route_run_credits
  DROP CONSTRAINT IF EXISTS route_run_credits_car_status_check,
  DROP CONSTRAINT IF EXISTS route_run_credits_dash_status_check,
  ADD CONSTRAINT route_run_credits_car_status_check
    CHECK (car_status IN ('accepted', 'early', 'late', 'off_location', 'no_location', 'library', 'unverified')),
  ADD CONSTRAINT route_run_credits_dash_status_check
    CHECK (dash_status IN ('accepted', 'early', 'late', 'off_location', 'no_location', 'library', 'unverified')),
  ADD COLUMN attested boolean NOT NULL DEFAULT false,
  ADD COLUMN nonce_jti uuid UNIQUE;
GRANT SELECT (attested) ON public.route_run_credits TO authenticated;

COMMIT;
