-- Route all-time top 3, and finish photos that never reach our servers.
--
-- 1. Each route's home screen lists its all-time top 3 (TJ, 2026-11-27): each member's
--    single best accepted time, once, with their username (members.display_name).
--    Members only. No member id, member number, attempt id, date or other runs are
--    returned. Everything else about a member's runs stays private (my_run_top_threes,
--    my_route_history, route_run_attempts RLS).
-- 2. The finish photo stays on the member's phone. The API receives only a non-image
--    proof (capture time, GPS fix, optional image hash), checks the fix against the
--    finish in memory, and stores only the credit result. Photo location and storage
--    paths are removed from route_run_credits.
-- Never applied to a live project from this branch; reviewed and applied by an operator.
BEGIN;

-- 1. All-time top 3 ----------------------------------------------------------------

-- route_run_finishes rows are written only by services/api after server-side route
-- validation of the GPS trace, so every row is an accepted finish.
CREATE INDEX IF NOT EXISTS route_run_best_by_member
  ON public.route_run_finishes(route_slug, member_id, duration_ms, attempt_id);

CREATE FUNCTION public.route_all_time_top_three(target_route text)
RETURNS TABLE(place integer, username text, duration_ms bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH best AS (
    SELECT DISTINCT ON (f.member_id) f.member_id, f.duration_ms, a.finished_at
    FROM public.route_run_finishes f
    LEFT JOIN public.route_run_attempts a USING (member_id, attempt_id)
    WHERE f.route_slug = target_route
    ORDER BY f.member_id, f.duration_ms, a.finished_at NULLS LAST, f.attempt_id
  )
  SELECT (row_number() OVER (ORDER BY b.duration_ms, b.finished_at NULLS LAST, b.member_id))::integer,
         m.display_name,
         b.duration_ms
  FROM best b
  JOIN public.members m ON m.id = b.member_id
  WHERE public.current_member_id() IS NOT NULL
  ORDER BY 1
  LIMIT 3
$$;
REVOKE ALL ON FUNCTION public.route_all_time_top_three(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.route_all_time_top_three(text) TO authenticated, service_role;

-- 2. Finish photo privacy ----------------------------------------------------------

-- Dropping the columns deletes any stored photo location and storage path right away.
-- (The credit result stays: tier, points, per-photo status, capture times.)
ALTER TABLE public.route_run_credits
  DROP COLUMN IF EXISTS car_lat,
  DROP COLUMN IF EXISTS car_lng,
  DROP COLUMN IF EXISTS dash_lat,
  DROP COLUMN IF EXISTS dash_lng,
  DROP COLUMN IF EXISTS car_photo_path,
  DROP COLUMN IF EXISTS dash_photo_path,
  ADD COLUMN verified boolean GENERATED ALWAYS AS (tier <> 'none') STORED,
  -- SHA-256 of the stripped image kept on the phone. Not an image and not a location;
  -- used only to refuse the same photo being reused for another run.
  ADD COLUMN car_image_sha256 text CHECK (car_image_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN dash_image_sha256 text CHECK (dash_image_sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT route_run_credit_distinct_images CHECK (car_image_sha256 IS DISTINCT FROM dash_image_sha256 OR car_image_sha256 IS NULL);
CREATE UNIQUE INDEX route_run_credit_car_image ON public.route_run_credits(car_image_sha256) WHERE car_image_sha256 IS NOT NULL;
CREATE UNIQUE INDEX route_run_credit_dash_image ON public.route_run_credits(dash_image_sha256) WHERE dash_image_sha256 IS NOT NULL;

GRANT SELECT (verified) ON public.route_run_credits TO authenticated;

COMMENT ON TABLE public.route_run_credits IS
  'Finish-photo credit result only. Photos stay on the phone; photo location is checked by the API in memory and never stored.';

-- Run finish photos are no longer uploaded to evidence-originals (runs/<member>/...).
-- The bucket has no client policies for runs/, and the API no longer signs uploads there.
-- If any runs/ objects exist from testing, an operator removes them with the Storage API
-- (direct DELETE on storage.objects is blocked by Supabase).

COMMIT;
