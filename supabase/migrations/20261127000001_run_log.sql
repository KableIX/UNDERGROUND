-- Run log (step 1): private per-attempt analytics, abort reasons, and finish-photo credit.
--
-- Rules:
-- * GPS proves completion. A credit row must reference a server-validated
--   route_run_finishes row for the same attempt (foreign key below).
-- * Finish photo tiers: dash only = verified, car only = car, both = top.
-- * Speed and time are PRIVATE: owners read their own rows; nothing here is ranked
--   between members or used to decide who holds a route.
-- * Photo location (car_lat/lng, dash_lat/lng) is readable by the service role only.
-- Writes come from services/api with the service role. Clients never insert directly.
BEGIN;

CREATE TABLE public.route_run_attempts (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  attempt_id text NOT NULL CHECK (attempt_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  route_slug text NOT NULL CHECK (char_length(route_slug) BETWEEN 1 AND 120),
  outcome text NOT NULL CHECK (outcome IN ('completed', 'aborted')),
  abort_reason text CHECK (abort_reason IN ('traffic', 'road_closed', 'weather', 'car_trouble', 'lost_gps', 'phone_issue')),
  progress_m double precision NOT NULL CHECK (progress_m >= 0),
  progress_pct numeric(5,1) NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  finished_at timestamptz,
  -- Local garage reference; vetting already proved ownership, so this is a label, not proof.
  vehicle_ref text CHECK (char_length(vehicle_ref) <= 100),
  -- Coarse ~1 km grid label only. Never a precise start point.
  start_label text CHECK (char_length(start_label) <= 40),
  distance_m double precision NOT NULL CHECK (distance_m >= 0),
  active_ms bigint NOT NULL CHECK (active_ms >= 0),
  moving_ms bigint NOT NULL CHECK (moving_ms >= 0),
  stopped_ms bigint NOT NULL CHECK (stopped_ms >= 0),
  avg_speed_mps real CHECK (avg_speed_mps BETWEEN 0 AND 85),
  avg_moving_speed_mps real CHECK (avg_moving_speed_mps BETWEEN 0 AND 85),
  max_speed_mps real CHECK (max_speed_mps BETWEEN 0 AND 85),
  elevation_gain_m real CHECK (elevation_gain_m >= 0),
  elevation_loss_m real CHECK (elevation_loss_m >= 0),
  min_altitude_m real,
  max_altitude_m real,
  start_local_hour smallint CHECK (start_local_hour BETWEEN 0 AND 23),
  time_of_day text CHECK (time_of_day IN ('dawn', 'morning', 'afternoon', 'evening', 'night')),
  gps_coverage_pct real NOT NULL CHECK (gps_coverage_pct BETWEEN 0 AND 100),
  good_fix_pct real NOT NULL CHECK (good_fix_pct BETWEEN 0 AND 100),
  sample_count integer NOT NULL CHECK (sample_count >= 0),
  signal_gap_count integer NOT NULL CHECK (signal_gap_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, attempt_id),
  CHECK (ended_at >= started_at),
  CHECK (
    (outcome = 'aborted' AND abort_reason IS NOT NULL AND finished_at IS NULL)
    OR (outcome = 'completed' AND abort_reason IS NULL AND finished_at IS NOT NULL)
  )
);
CREATE INDEX route_run_attempts_history ON public.route_run_attempts(member_id, route_slug, ended_at);

CREATE TABLE public.route_run_credits (
  member_id uuid NOT NULL,
  attempt_id text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('none', 'verified', 'car', 'top')),
  points integer NOT NULL CHECK (points >= 0),
  car_status text CHECK (car_status IN ('accepted', 'early', 'late', 'off_location', 'no_location')),
  dash_status text CHECK (dash_status IN ('accepted', 'early', 'late', 'off_location', 'no_location')),
  car_photo_path text,
  dash_photo_path text,
  car_taken_at timestamptz,
  dash_taken_at timestamptz,
  car_lat double precision CHECK (car_lat BETWEEN -90 AND 90),
  car_lng double precision CHECK (car_lng BETWEEN -180 AND 180),
  dash_lat double precision CHECK (dash_lat BETWEEN -90 AND 90),
  dash_lng double precision CHECK (dash_lng BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, attempt_id),
  FOREIGN KEY (member_id, attempt_id) REFERENCES public.route_run_finishes(member_id, attempt_id) ON DELETE CASCADE,
  CHECK (car_photo_path IS NULL OR car_photo_path = 'runs/' || member_id::text || '/' || attempt_id || '/car.jpg'),
  CHECK (dash_photo_path IS NULL OR dash_photo_path = 'runs/' || member_id::text || '/' || attempt_id || '/dash.jpg')
);

ALTER TABLE public.route_run_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_run_credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.route_run_attempts, public.route_run_credits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.route_run_attempts, public.route_run_credits TO service_role;

-- Owners read their own attempts (their private stats).
GRANT SELECT ON public.route_run_attempts TO authenticated;
CREATE POLICY own_run_attempts ON public.route_run_attempts FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());

-- Owners read their own credit, without photo location or storage paths.
GRANT SELECT (member_id, attempt_id, tier, points, car_status, dash_status, car_taken_at, dash_taken_at, updated_at)
  ON public.route_run_credits TO authenticated;
CREATE POLICY own_run_credits ON public.route_run_credits FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());

-- Personal per-route history for the signed-in member only.
CREATE FUNCTION public.my_route_history(target_route text)
RETURNS TABLE(completed bigint, aborted bigint, best_ms bigint, recent_ms bigint[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    count(*) FILTER (WHERE a.outcome = 'completed'),
    count(*) FILTER (WHERE a.outcome = 'aborted'),
    (SELECT min(f.duration_ms) FROM public.route_run_finishes f
      WHERE f.member_id = public.current_member_id() AND f.route_slug = target_route),
    coalesce((SELECT array_agg(r.duration_ms ORDER BY r.ended_at) FROM (
      SELECT f.duration_ms, x.ended_at
      FROM public.route_run_finishes f
      JOIN public.route_run_attempts x USING (member_id, attempt_id)
      WHERE f.member_id = public.current_member_id() AND f.route_slug = target_route
      ORDER BY x.ended_at DESC LIMIT 10) r), ARRAY[]::bigint[])
  FROM public.route_run_attempts a
  WHERE public.current_member_id() IS NOT NULL
    AND a.member_id = public.current_member_id() AND a.route_slug = target_route
$$;
REVOKE ALL ON FUNCTION public.my_route_history(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_route_history(text) TO authenticated;

COMMIT;
