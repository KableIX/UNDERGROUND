BEGIN;
CREATE TABLE public.route_run_finishes (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  attempt_id text NOT NULL,
  route_slug text NOT NULL,
  duration_ms bigint NOT NULL CHECK (duration_ms > 0),
  PRIMARY KEY (member_id, attempt_id)
);
CREATE INDEX route_run_fastest ON public.route_run_finishes(route_slug, duration_ms, member_id, attempt_id);
CREATE INDEX personal_run_fastest ON public.route_run_finishes(member_id, route_slug, duration_ms, attempt_id);
CREATE TABLE public.personal_run_bests (
  member_id uuid NOT NULL,
  route_slug text NOT NULL,
  attempt_id text NOT NULL,
  PRIMARY KEY (member_id,route_slug,attempt_id),
  FOREIGN KEY(member_id,attempt_id) REFERENCES public.route_run_finishes(member_id,attempt_id) ON DELETE CASCADE
);
ALTER TABLE public.personal_run_bests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_run_bests FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.refresh_personal_run_bests() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owner_id uuid := coalesce(NEW.member_id,OLD.member_id);
  slug text := coalesce(NEW.route_slug,OLD.route_slug);
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(owner_id::text || '/' || slug, 0));
  DELETE FROM public.personal_run_bests WHERE member_id=owner_id AND route_slug=slug;
  INSERT INTO public.personal_run_bests(member_id,route_slug,attempt_id)
    SELECT member_id,route_slug,attempt_id FROM public.route_run_finishes
    WHERE member_id=owner_id AND route_slug=slug ORDER BY duration_ms,attempt_id LIMIT 3;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.refresh_personal_run_bests() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER refresh_personal_run_bests AFTER INSERT OR DELETE ON public.route_run_finishes
FOR EACH ROW EXECUTE FUNCTION public.refresh_personal_run_bests();

CREATE TABLE public.cruise_completions (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  route_slug text NOT NULL,
  PRIMARY KEY (member_id, route_slug)
);
ALTER TABLE public.route_run_finishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cruise_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.route_run_finishes, public.cruise_completions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.route_run_finishes, public.cruise_completions TO service_role;
GRANT SELECT ON public.cruise_completions TO authenticated;
CREATE POLICY own_cruise_completions ON public.cruise_completions FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());

CREATE FUNCTION public.route_top_three(target_route text)
RETURNS TABLE(route text, name text, millis bigint, place bigint, attempt text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT f.route_slug, m.display_name, f.duration_ms,
    row_number() OVER (ORDER BY f.duration_ms, f.member_id, f.attempt_id), f.attempt_id
  FROM public.route_run_finishes f JOIN public.members m ON m.id = f.member_id
  WHERE public.current_member_id() IS NOT NULL AND f.route_slug = target_route
  ORDER BY f.duration_ms, f.member_id, f.attempt_id LIMIT 3
$$;
CREATE FUNCTION public.my_run_top_threes()
RETURNS TABLE(route text, name text, millis bigint, place bigint, attempt text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ranked.* FROM (
    SELECT f.route_slug, m.display_name, f.duration_ms,
      row_number() OVER (PARTITION BY f.route_slug ORDER BY f.duration_ms, f.attempt_id) AS position, f.attempt_id
    FROM public.personal_run_bests p JOIN public.route_run_finishes f USING(member_id,route_slug,attempt_id) JOIN public.members m ON m.id = f.member_id
    WHERE f.member_id = public.current_member_id()
  ) ranked WHERE position <= 3 ORDER BY route_slug, position
$$;
REVOKE ALL ON FUNCTION public.route_top_three(text), public.my_run_top_threes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.route_top_three(text), public.my_run_top_threes() TO authenticated;
COMMIT;
