-- Private run times + 90-day raw data retention (TJ, 2026-11-27).
--
-- 1. Run times are never ranked between members. route_top_three() listed the three
--    fastest members on a route by name; it is dropped. Personal bests stay, readable
--    only by their owner through my_run_top_threes() (filtered to the caller).
-- 2. Raw per-point GPS, speed and track data is kept 90 days, then purged. Only the
--    summary stays: average speed, completion time, distance (and non-speed counts).
BEGIN;

DROP FUNCTION IF EXISTS public.route_top_three(text);
-- The cross-member "fastest on route" index only served route_top_three.
DROP INDEX IF EXISTS public.route_run_fastest;

ALTER TABLE public.route_run_attempts ADD COLUMN raw_purged_at timestamptz;

-- Purge raw run data older than `retain` (default 90 days). Service role / scheduler only.
CREATE FUNCTION public.purge_raw_run_data(retain interval DEFAULT interval '90 days')
RETURNS TABLE(gps_points bigint, checkpoints bigint, attempts_trimmed bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  cutoff timestamptz;
  n_points bigint;
  n_checkpoints bigint;
  n_attempts bigint;
BEGIN
  IF retain < interval '1 day' THEN
    RAISE EXCEPTION 'retention must be at least one day';
  END IF;
  cutoff := now() - retain;

  -- Per-point track (location + accuracy) for runs.
  DELETE FROM public.run_gps_tracks WHERE recorded_at < cutoff;
  GET DIAGNOSTICS n_points = ROW_COUNT;
  DELETE FROM public.run_checkpoints WHERE reached_at < cutoff;
  GET DIAGNOSTICS n_checkpoints = ROW_COUNT;

  -- Keep avg speed, completion time (active_ms) and distance; drop speed-derived detail.
  UPDATE public.route_run_attempts
     SET max_speed_mps = NULL, avg_moving_speed_mps = NULL, raw_purged_at = now()
   WHERE ended_at < cutoff AND raw_purged_at IS NULL;
  GET DIAGNOSTICS n_attempts = ROW_COUNT;

  RETURN QUERY SELECT n_points, n_checkpoints, n_attempts;
END $$;
REVOKE ALL ON FUNCTION public.purge_raw_run_data(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_raw_run_data(interval) TO service_role;

-- Schedule daily at 03:17 UTC when pg_cron is installed (Supabase: Database > Extensions > pg_cron).
-- This migration does not install the extension. Without it, run daily from the API host:
--   select * from public.purge_raw_run_data();
-- See docs/run-data-retention.md.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('purge-raw-run-data', '17 3 * * *', 'select * from public.purge_raw_run_data()');
  ELSE
    RAISE NOTICE 'pg_cron not installed: schedule public.purge_raw_run_data() daily (docs/run-data-retention.md)';
  END IF;
END
$cron$;

COMMIT;
