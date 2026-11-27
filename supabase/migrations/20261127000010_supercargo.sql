-- SupercarGO: optional car spotting for members.
-- Theft safety lives in the schema: precise points are service-only, the map
-- is a function that returns neighborhood cells after a hold, and folios move
-- only through checked functions. See docs/decisions/ADR-car-spotting.md.
BEGIN;

-- Member settings: the mode is off until a member turns it on.
CREATE TABLE public.supercargo_settings (
  member_id uuid PRIMARY KEY DEFAULT public.current_member_id() REFERENCES public.members(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  credit_public boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supercargo_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.supercargo_settings TO authenticated;
CREATE POLICY supercargo_settings_own ON public.supercargo_settings FOR ALL TO authenticated
  USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- Catalog: our own list. A tier above Open needs a sourced production number.
CREATE TABLE public.supercargo_catalog (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,80}$'),
  make text NOT NULL CHECK (length(make) BETWEEN 1 AND 80),
  model text NOT NULL CHECK (length(model) BETWEEN 1 AND 100),
  variant text CHECK (variant IS NULL OR length(variant) <= 100),
  built integer CHECK (built IS NULL OR built > 0),
  built_source text CHECK (built_source IS NULL OR length(built_source) <= 300),
  first_year smallint CHECK (first_year IS NULL OR first_year BETWEEN 1885 AND 2100),
  tier text NOT NULL DEFAULT 'open' CHECK (tier IN ('open','limited','numbered','allocated','atelier','singular')),
  score smallint NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supercargo_catalog_sourced CHECK (built IS NULL OR built_source IS NOT NULL),
  CONSTRAINT supercargo_catalog_tier_needs_source CHECK (tier = 'open' OR built IS NOT NULL)
);
ALTER TABLE public.supercargo_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_catalog TO authenticated;
CREATE POLICY supercargo_catalog_members ON public.supercargo_catalog FOR SELECT TO authenticated
  USING (public.current_member_id() IS NOT NULL);

-- Private home zones. Nothing spotted inside one reaches the map.
CREATE TABLE public.supercargo_home_zones (
  member_id uuid PRIMARY KEY DEFAULT public.current_member_id() REFERENCES public.members(id) ON DELETE CASCADE,
  zone geography(Point, 4326) NOT NULL,
  radius_m integer NOT NULL DEFAULT 400 CHECK (radius_m BETWEEN 200 AND 2000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supercargo_home_zones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_home_zones FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supercargo_home_zones TO authenticated;
CREATE POLICY supercargo_home_own ON public.supercargo_home_zones FOR ALL TO authenticated
  USING (member_id = public.current_member_id()) WITH CHECK (member_id = public.current_member_id());

-- Owner opt-out, per garage vehicle.
CREATE TABLE public.supercargo_optouts (
  vehicle_id uuid PRIMARY KEY REFERENCES public.vehicles(id) ON DELETE CASCADE,
  owner_member_id uuid NOT NULL DEFAULT public.current_member_id() REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supercargo_optouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_optouts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.supercargo_optouts TO authenticated;
CREATE POLICY supercargo_optout_read ON public.supercargo_optouts FOR SELECT TO authenticated
  USING (owner_member_id = public.current_member_id());
CREATE POLICY supercargo_optout_add ON public.supercargo_optouts FOR INSERT TO authenticated
  WITH CHECK (owner_member_id = public.current_member_id() AND EXISTS (
    SELECT 1 FROM public.vehicles v WHERE v.id = vehicle_id AND v.owner_member_id = public.current_member_id()));
CREATE POLICY supercargo_optout_remove ON public.supercargo_optouts FOR DELETE TO authenticated
  USING (owner_member_id = public.current_member_id());

-- Sightings. Written only by the API (service role). Members read their own.
CREATE TABLE public.supercargo_sightings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotter uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  catalog_id text REFERENCES public.supercargo_catalog(id),
  make text NOT NULL CHECK (length(make) BETWEEN 1 AND 80),
  model text NOT NULL CHECK (length(model) BETWEEN 1 AND 100),
  tier text NOT NULL DEFAULT 'open' CHECK (tier IN ('open','limited','numbered','allocated','atelier','singular')),
  source text NOT NULL CHECK (source IN ('camera','library')),
  credited boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','held','public','removed')),
  hold_reason text CHECK (hold_reason IS NULL OR length(hold_reason) <= 80),
  redaction text NOT NULL DEFAULT 'pending' CHECK (redaction IN ('pending','done','failed')),
  captured_at timestamptz NOT NULL,
  publish_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  cell_id text NOT NULL CHECK (length(cell_id) <= 60),
  cell_lat double precision NOT NULL CHECK (cell_lat BETWEEN -90 AND 90),
  cell_lng double precision NOT NULL CHECK (cell_lng BETWEEN -180 AND 180),
  photo_path text CHECK (photo_path IS NULL OR photo_path ~ '^supercargo/redacted/[a-z0-9/-]{8,120}\.jpg$'),
  meet_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supercargo_credit_needs_camera CHECK (NOT credited OR source = 'camera'),
  CONSTRAINT supercargo_public_needs_redaction CHECK (
    visibility <> 'public' OR (source = 'camera' AND credited AND redaction = 'done' AND photo_path IS NOT NULL)),
  CONSTRAINT supercargo_hold_minimum CHECK (publish_at >= captured_at + CASE WHEN meet_id IS NULL THEN interval '6 hours' ELSE interval '1 hour' END),
  CONSTRAINT supercargo_window CHECK (expires_at <= captured_at + interval '72 hours' AND expires_at > publish_at)
);
CREATE INDEX supercargo_sightings_spotter ON public.supercargo_sightings (spotter, captured_at DESC);
CREATE INDEX supercargo_sightings_map ON public.supercargo_sightings (cell_lat, cell_lng) WHERE visibility = 'public';
ALTER TABLE public.supercargo_sightings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_sightings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_sightings TO authenticated;
CREATE POLICY supercargo_sightings_own ON public.supercargo_sightings FOR SELECT TO authenticated
  USING (spotter = public.current_member_id());

-- Precise points: service role only, purged after 30 days. Used for anti-cheat.
CREATE TABLE public.supercargo_sighting_points (
  sighting_id uuid PRIMARY KEY REFERENCES public.supercargo_sightings(id) ON DELETE CASCADE,
  point geography(Point, 4326) NOT NULL,
  accuracy_m real NOT NULL CHECK (accuracy_m > 0),
  purge_after timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
ALTER TABLE public.supercargo_sighting_points ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_sighting_points FROM PUBLIC, anon, authenticated;

-- Curated public places. Never a residential street.
CREATE TABLE public.supercargo_anchors (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,80}$'),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  kind text NOT NULL CHECK (kind IN ('route_start','route_finish','overlook','venue','museum','event','curated_meet')),
  point geography(Point, 4326) NOT NULL,
  reviewed_public boolean NOT NULL CHECK (reviewed_public),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.supercargo_anchors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_anchors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_anchors TO authenticated;
CREATE POLICY supercargo_anchors_members ON public.supercargo_anchors FOR SELECT TO authenticated
  USING (active AND public.current_member_id() IS NOT NULL);

-- Curated meets: a reviewed curated_meet anchor, for a few hours. Sightings
-- captured inside one show after one hour instead of six. Still a cell.
CREATE TABLE public.supercargo_meets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_id text NOT NULL REFERENCES public.supercargo_anchors(id),
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  radius_m integer NOT NULL DEFAULT 200 CHECK (radius_m BETWEEN 50 AND 400),
  reviewed_by uuid NOT NULL DEFAULT public.current_member_id() REFERENCES public.members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supercargo_meet_window CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '12 hours')
);
CREATE FUNCTION public.supercargo_meet_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supercargo_anchors a WHERE a.id = NEW.anchor_id AND a.kind = 'curated_meet' AND a.reviewed_public) THEN
    RAISE EXCEPTION 'meets need a reviewed curated_meet anchor' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER supercargo_meet_guard BEFORE INSERT OR UPDATE ON public.supercargo_meets
  FOR EACH ROW EXECUTE FUNCTION public.supercargo_meet_guard();
ALTER TABLE public.supercargo_meets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_meets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supercargo_meets TO authenticated;
CREATE POLICY supercargo_meets_members ON public.supercargo_meets FOR SELECT TO authenticated
  USING (public.current_member_id() IS NOT NULL);
CREATE POLICY supercargo_meets_admin ON public.supercargo_meets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = public.current_member_id() AND m.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = public.current_member_id() AND m.role = 'admin'));

ALTER TABLE public.supercargo_sightings
  ADD CONSTRAINT supercargo_sightings_meet FOREIGN KEY (meet_id) REFERENCES public.supercargo_meets(id);
CREATE FUNCTION public.supercargo_sighting_meet_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.meet_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM supercargo_meets m WHERE m.id = NEW.meet_id AND NEW.captured_at BETWEEN m.starts_at AND m.ends_at) THEN
    RAISE EXCEPTION 'capture outside the meet' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER supercargo_sighting_meet_guard BEFORE INSERT OR UPDATE ON public.supercargo_sightings
  FOR EACH ROW EXECUTE FUNCTION public.supercargo_sighting_meet_guard();

-- Featured car of the week, set by an admin. Appears in about one envelope in ten.
CREATE TABLE public.supercargo_featured (
  week_start date PRIMARY KEY CHECK (extract(isodow FROM week_start) = 1),
  catalog_id text NOT NULL REFERENCES public.supercargo_catalog(id),
  note text CHECK (note IS NULL OR length(note) <= 200),
  set_by uuid NOT NULL DEFAULT public.current_member_id() REFERENCES public.members(id),
  set_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supercargo_featured ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_featured FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.supercargo_featured TO authenticated;
CREATE POLICY supercargo_featured_members ON public.supercargo_featured FOR SELECT TO authenticated
  USING (public.current_member_id() IS NOT NULL);
CREATE POLICY supercargo_featured_admin_add ON public.supercargo_featured FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.members m WHERE m.id = public.current_member_id() AND m.role = 'admin'));
CREATE POLICY supercargo_featured_admin_edit ON public.supercargo_featured FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.members m WHERE m.id = public.current_member_id() AND m.role = 'admin'));

-- Envelopes: sealed folios at anchors. The contents stay hidden until claimed.
CREATE TABLE public.supercargo_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_id text NOT NULL REFERENCES public.supercargo_anchors(id),
  catalog_id text NOT NULL REFERENCES public.supercargo_catalog(id),
  opens_at timestamptz NOT NULL,
  closes_at timestamptz NOT NULL,
  stock smallint NOT NULL CHECK (stock BETWEEN 1 AND 50),
  claimed smallint NOT NULL DEFAULT 0,
  CONSTRAINT supercargo_envelope_window CHECK (closes_at > opens_at AND closes_at <= opens_at + interval '72 hours'),
  CONSTRAINT supercargo_envelope_stock CHECK (claimed BETWEEN 0 AND stock)
);
ALTER TABLE public.supercargo_envelopes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_envelopes FROM PUBLIC, anon, authenticated;

CREATE TABLE public.supercargo_envelope_claims (
  envelope_id uuid NOT NULL REFERENCES public.supercargo_envelopes(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (envelope_id, member_id)
);
ALTER TABLE public.supercargo_envelope_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_envelope_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_envelope_claims TO authenticated;
CREATE POLICY supercargo_claims_own ON public.supercargo_envelope_claims FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());

-- The Ledger: one folio per credited sighting or claimed envelope.
CREATE TABLE public.supercargo_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  catalog_id text NOT NULL REFERENCES public.supercargo_catalog(id),
  origin text NOT NULL CHECK (origin IN ('sighting','envelope')),
  sighting_id uuid UNIQUE REFERENCES public.supercargo_sightings(id) ON DELETE CASCADE,
  envelope_id uuid REFERENCES public.supercargo_envelopes(id),
  acquired_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supercargo_ledger_origin CHECK (
    (origin = 'sighting' AND sighting_id IS NOT NULL AND envelope_id IS NULL) OR
    (origin = 'envelope' AND envelope_id IS NOT NULL AND sighting_id IS NULL))
);
CREATE INDEX supercargo_ledger_member ON public.supercargo_ledger (member_id, acquired_at DESC);
ALTER TABLE public.supercargo_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_ledger TO authenticated;
CREATE POLICY supercargo_ledger_own ON public.supercargo_ledger FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());

CREATE FUNCTION public.supercargo_ledger_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.origin = 'sighting' THEN
    IF TG_OP = 'UPDATE' AND NEW.member_id <> OLD.member_id THEN
      RAISE EXCEPTION 'sighting folios do not change hands' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.supercargo_sightings s
                   WHERE s.id = NEW.sighting_id AND s.spotter = NEW.member_id AND s.credited) THEN
      RAISE EXCEPTION 'folio needs a credited sighting by its holder' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER supercargo_ledger_guard BEFORE INSERT OR UPDATE ON public.supercargo_ledger
  FOR EACH ROW EXECUTE FUNCTION public.supercargo_ledger_guard();

-- The Exchange.
CREATE TABLE public.supercargo_exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  counterparty uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  offered uuid[] NOT NULL,
  requested uuid[] NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','declined','withdrawn','void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CONSTRAINT supercargo_exchange_parties CHECK (proposer <> counterparty),
  CONSTRAINT supercargo_exchange_size CHECK (cardinality(offered) BETWEEN 1 AND 3 AND cardinality(requested) BETWEEN 1 AND 3)
);
ALTER TABLE public.supercargo_exchanges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_exchanges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_exchanges TO authenticated;
CREATE POLICY supercargo_exchanges_parties ON public.supercargo_exchanges FOR SELECT TO authenticated
  USING (public.current_member_id() IN (proposer, counterparty));

-- Reports and moderation decisions (visible to the spotter: no silent removals).
CREATE TABLE public.supercargo_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id uuid NOT NULL REFERENCES public.supercargo_sightings(id) ON DELETE CASCADE,
  reporter uuid NOT NULL DEFAULT public.current_member_id() REFERENCES public.members(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('plate_visible','face_visible','residential','owner_request','stalking','wrong_model','not_original','spam')),
  note text CHECK (note IS NULL OR length(note) <= 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sighting_id, reporter)
);
ALTER TABLE public.supercargo_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_reports TO authenticated;
GRANT INSERT (sighting_id, reason, note) ON public.supercargo_reports TO authenticated;
CREATE POLICY supercargo_reports_own ON public.supercargo_reports FOR SELECT TO authenticated
  USING (reporter = public.current_member_id());
CREATE POLICY supercargo_reports_file ON public.supercargo_reports FOR INSERT TO authenticated
  WITH CHECK (reporter = public.current_member_id());

CREATE FUNCTION public.supercargo_report_hold() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM supercargo_sightings s WHERE s.id = NEW.sighting_id
                 AND (s.visibility = 'public' OR s.spotter = NEW.reporter)) THEN
    RAISE EXCEPTION 'not visible to reporter' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT count(DISTINCT reporter) INTO n FROM supercargo_reports WHERE sighting_id = NEW.sighting_id;
  IF NEW.reason IN ('plate_visible','face_visible','residential','owner_request','stalking') OR n >= 3 THEN
    UPDATE supercargo_sightings SET visibility = 'held', hold_reason = 'report:' || NEW.reason
     WHERE id = NEW.sighting_id AND visibility = 'public';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER supercargo_report_hold AFTER INSERT ON public.supercargo_reports
  FOR EACH ROW EXECUTE FUNCTION public.supercargo_report_hold();

CREATE TABLE public.supercargo_moderation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sighting_id uuid NOT NULL REFERENCES public.supercargo_sightings(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('restore','remove','correct_model')),
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 280),
  decided_by uuid NOT NULL REFERENCES public.members(id),
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supercargo_moderation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_moderation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_moderation TO authenticated;
CREATE POLICY supercargo_moderation_spotter ON public.supercargo_moderation FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.supercargo_sightings s WHERE s.id = sighting_id AND s.spotter = public.current_member_id()));

-- Commissions: weekly, count-based. Marks record completion.
CREATE TABLE public.supercargo_commissions (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9-]{2,80}$'),
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  rule jsonb NOT NULL CHECK (rule->>'kind' IN ('sightings','distinct_makes','distinct_cells','envelopes')),
  target smallint NOT NULL CHECK (target BETWEEN 1 AND 20)
);
ALTER TABLE public.supercargo_commissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_commissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_commissions TO authenticated;
CREATE POLICY supercargo_commissions_members ON public.supercargo_commissions FOR SELECT TO authenticated
  USING (public.current_member_id() IS NOT NULL);

CREATE TABLE public.supercargo_marks (
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  commission_id text NOT NULL REFERENCES public.supercargo_commissions(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, commission_id)
);
ALTER TABLE public.supercargo_marks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_marks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_marks TO authenticated;
CREATE POLICY supercargo_marks_own ON public.supercargo_marks FOR SELECT TO authenticated
  USING (member_id = public.current_member_id());

-- The map: members only, after the hold, cells only. Spotter shown only by choice.
CREATE FUNCTION public.supercargo_map(p_west double precision, p_south double precision, p_east double precision, p_north double precision)
RETURNS TABLE (id uuid, cell_id text, cell_lat double precision, cell_lng double precision, make text, model text,
               tier text, photo_path text, seen_on date, spotter_number char(6))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.cell_id, s.cell_lat, s.cell_lng, s.make, s.model, s.tier, s.photo_path,
         (s.captured_at AT TIME ZONE 'UTC')::date,
         CASE WHEN st.credit_public THEN m.member_number END
    FROM supercargo_sightings s
    JOIN members m ON m.id = s.spotter
    LEFT JOIN supercargo_settings st ON st.member_id = s.spotter
   WHERE public.current_member_id() IS NOT NULL
     AND s.visibility = 'public'
     AND now() >= s.publish_at AND now() < s.expires_at
     AND s.cell_lat BETWEEN p_south AND p_north
     AND s.cell_lng BETWEEN p_west AND p_east
   ORDER BY s.publish_at DESC
   LIMIT 500
$$;
REVOKE ALL ON FUNCTION public.supercargo_map(double precision, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_map(double precision, double precision, double precision, double precision) TO authenticated;

-- Sealed envelopes near a point. Contents are not returned.
CREATE FUNCTION public.supercargo_envelopes_near(p_lng double precision, p_lat double precision)
RETURNS TABLE (id uuid, anchor_name text, anchor_kind text, lng double precision, lat double precision, closes_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, a.name, a.kind, ST_X(a.point::geometry), ST_Y(a.point::geometry), e.closes_at
    FROM supercargo_envelopes e JOIN supercargo_anchors a ON a.id = e.anchor_id
   WHERE public.current_member_id() IS NOT NULL
     AND a.active AND now() >= e.opens_at AND now() < e.closes_at AND e.claimed < e.stock
     AND ST_DWithin(a.point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, 5000)
     AND NOT EXISTS (SELECT 1 FROM supercargo_envelope_claims c WHERE c.envelope_id = e.id AND c.member_id = public.current_member_id())
   LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.supercargo_envelopes_near(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_envelopes_near(double precision, double precision) TO authenticated;

-- Claim: service role only, called by the API after it has checked the fix.
CREATE FUNCTION public.supercargo_claim_envelope(p_member uuid, p_envelope uuid, p_lng double precision, p_lat double precision, p_accuracy_m real)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e record; dist double precision;
BEGIN
  IF p_accuracy_m IS NULL OR p_accuracy_m <= 0 OR p_accuracy_m > 50 THEN RETURN 'weak_fix'; END IF;
  SELECT en.*, a.point INTO e FROM supercargo_envelopes en JOIN supercargo_anchors a ON a.id = en.anchor_id
   WHERE en.id = p_envelope AND a.active FOR UPDATE OF en;
  IF NOT FOUND THEN RETURN 'closed'; END IF;
  IF EXISTS (SELECT 1 FROM supercargo_envelope_claims WHERE envelope_id = p_envelope AND member_id = p_member) THEN RETURN 'already'; END IF;
  IF now() < e.opens_at OR now() >= e.closes_at THEN RETURN 'closed'; END IF;
  IF e.claimed >= e.stock THEN RETURN 'empty'; END IF;
  dist := ST_Distance(e.point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography);
  IF dist > 60 THEN RETURN 'too_far'; END IF;
  INSERT INTO supercargo_envelope_claims (envelope_id, member_id) VALUES (p_envelope, p_member);
  UPDATE supercargo_envelopes SET claimed = claimed + 1 WHERE id = p_envelope;
  INSERT INTO supercargo_ledger (member_id, catalog_id, origin, envelope_id) VALUES (p_member, e.catalog_id, 'envelope', p_envelope);
  RETURN 'claimed';
END $$;
REVOKE ALL ON FUNCTION public.supercargo_claim_envelope(uuid, uuid, double precision, double precision, real) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_claim_envelope(uuid, uuid, double precision, double precision, real) TO service_role;

-- Propose: envelope folios only, settled 24 hours, at most 5 open offers.
CREATE FUNCTION public.supercargo_propose_exchange(p_counterparty uuid, p_offered uuid[], p_requested uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_member_id(); new_id uuid; singular boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'members only' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF me = p_counterparty THEN RAISE EXCEPTION 'self' USING ERRCODE = 'check_violation'; END IF;
  IF cardinality(p_offered) NOT BETWEEN 1 AND 3 OR cardinality(p_requested) NOT BETWEEN 1 AND 3 THEN
    RAISE EXCEPTION 'size' USING ERRCODE = 'check_violation'; END IF;
  IF (SELECT count(*) FROM supercargo_ledger WHERE id = ANY(p_offered) AND member_id = me AND origin = 'envelope'
        AND acquired_at <= now() - interval '24 hours') <> cardinality(p_offered) THEN
    RAISE EXCEPTION 'offered folios not eligible' USING ERRCODE = 'check_violation'; END IF;
  IF (SELECT count(*) FROM supercargo_ledger WHERE id = ANY(p_requested) AND member_id = p_counterparty AND origin = 'envelope'
        AND acquired_at <= now() - interval '24 hours') <> cardinality(p_requested) THEN
    RAISE EXCEPTION 'requested folios not eligible' USING ERRCODE = 'check_violation'; END IF;
  IF (SELECT count(*) FROM supercargo_exchanges WHERE proposer = me AND status = 'open') >= 5 THEN
    RAISE EXCEPTION 'open offers' USING ERRCODE = 'check_violation'; END IF;
  SELECT bool_or(c.tier = 'singular') INTO singular FROM supercargo_ledger l JOIN supercargo_catalog c ON c.id = l.catalog_id
   WHERE l.id = ANY(p_offered || p_requested);
  IF singular AND EXISTS (SELECT 1 FROM members WHERE id IN (me, p_counterparty) AND created_at > now() - interval '30 days') THEN
    RAISE EXCEPTION 'tenure' USING ERRCODE = 'check_violation'; END IF;
  INSERT INTO supercargo_exchanges (proposer, counterparty, offered, requested) VALUES (me, p_counterparty, p_offered, p_requested)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_propose_exchange(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_propose_exchange(uuid, uuid[], uuid[]) TO authenticated;

-- Decide: the counterparty accepts or declines; the proposer may withdraw.
CREATE FUNCTION public.supercargo_decide_exchange(p_exchange uuid, p_accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_member_id(); x record; held integer;
BEGIN
  SELECT * INTO x FROM supercargo_exchanges WHERE id = p_exchange FOR UPDATE;
  IF NOT FOUND OR me IS NULL OR me NOT IN (x.proposer, x.counterparty) THEN
    RAISE EXCEPTION 'not a party' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF x.status <> 'open' THEN RETURN x.status; END IF;
  IF NOT p_accept THEN
    UPDATE supercargo_exchanges SET status = CASE WHEN me = x.proposer THEN 'withdrawn' ELSE 'declined' END, decided_at = now()
     WHERE id = p_exchange;
    RETURN CASE WHEN me = x.proposer THEN 'withdrawn' ELSE 'declined' END;
  END IF;
  IF me <> x.counterparty THEN RAISE EXCEPTION 'only the counterparty accepts' USING ERRCODE = 'insufficient_privilege'; END IF;
  PERFORM 1 FROM supercargo_ledger WHERE id = ANY(x.offered || x.requested) FOR UPDATE;
  SELECT count(*) INTO held FROM supercargo_ledger
   WHERE (id = ANY(x.offered) AND member_id = x.proposer) OR (id = ANY(x.requested) AND member_id = x.counterparty);
  IF held <> cardinality(x.offered) + cardinality(x.requested) THEN
    UPDATE supercargo_exchanges SET status = 'void', decided_at = now() WHERE id = p_exchange;
    RETURN 'void';
  END IF;
  UPDATE supercargo_ledger SET member_id = x.counterparty, acquired_at = now() WHERE id = ANY(x.offered);
  UPDATE supercargo_ledger SET member_id = x.proposer, acquired_at = now() WHERE id = ANY(x.requested);
  UPDATE supercargo_exchanges SET status = 'accepted', decided_at = now() WHERE id = p_exchange;
  UPDATE supercargo_exchanges SET status = 'void', decided_at = now()
   WHERE status = 'open' AND id <> p_exchange AND (offered && (x.offered || x.requested) OR requested && (x.offered || x.requested));
  RETURN 'accepted';
END $$;
REVOKE ALL ON FUNCTION public.supercargo_decide_exchange(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_decide_exchange(uuid, boolean) TO authenticated;

-- Photo fingerprints: exact SHA-256 and a 64-bit difference hash. Service only.
-- Fingerprints, never photos. Kept 90 days.
CREATE TABLE public.supercargo_image_hashes (
  sha256 text PRIMARY KEY CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  dhash bigint,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL DEFAULT now() + interval '90 days'
);
CREATE INDEX supercargo_image_hashes_recent ON public.supercargo_image_hashes (created_at DESC) WHERE dhash IS NOT NULL;
ALTER TABLE public.supercargo_image_hashes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_image_hashes FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.supercargo_image_seen(p_sha256 text, p_dhash bigint)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM supercargo_image_hashes WHERE sha256 = p_sha256)
      OR (p_dhash IS NOT NULL AND EXISTS (
            SELECT 1 FROM supercargo_image_hashes
             WHERE dhash IS NOT NULL AND created_at > now() - interval '90 days'
               AND bit_count((dhash # p_dhash)::bit(64)) <= 6))
$$;
REVOKE ALL ON FUNCTION public.supercargo_image_seen(text, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_image_seen(text, bigint) TO service_role;

-- Is this point inside a curated meet that is on right now? Service only.
CREATE FUNCTION public.supercargo_meet_at(p_lng double precision, p_lat double precision, p_at timestamptz)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id FROM supercargo_meets m JOIN supercargo_anchors a ON a.id = m.anchor_id
   WHERE a.active AND a.kind = 'curated_meet' AND p_at BETWEEN m.starts_at AND m.ends_at
     AND ST_DWithin(a.point, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, m.radius_m)
   ORDER BY m.starts_at DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.supercargo_meet_at(double precision, double precision, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_meet_at(double precision, double precision, timestamptz) TO service_role;

-- Stock envelopes at an anchor: featured car one time in ten when set for the
-- week, otherwise a tier by weight (40/25/18/10/5/2) and a car within it.
CREATE FUNCTION public.supercargo_stock_envelopes(p_anchor text, p_opens timestamptz, p_closes timestamptz, p_count integer, p_stock smallint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE i integer; featured text; pick text; chosen_tier text; roll double precision; total integer;
BEGIN
  IF p_count NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'count' USING ERRCODE = 'check_violation'; END IF;
  SELECT catalog_id INTO featured FROM supercargo_featured
   WHERE week_start = (date_trunc('week', p_opens AT TIME ZONE 'UTC'))::date;
  FOR i IN 1..p_count LOOP
    pick := NULL;
    IF featured IS NOT NULL AND random() < 0.1 THEN
      pick := featured;
    ELSE
      SELECT sum(w)::integer INTO total FROM (VALUES ('open',40),('limited',25),('numbered',18),('allocated',10),('atelier',5),('singular',2)) t(tier, w)
       WHERE EXISTS (SELECT 1 FROM supercargo_catalog c WHERE c.tier = t.tier);
      IF total IS NULL THEN RAISE EXCEPTION 'empty catalog' USING ERRCODE = 'check_violation'; END IF;
      roll := random() * total;
      SELECT tier INTO chosen_tier FROM (
        SELECT t.tier, sum(t.w) OVER (ORDER BY t.ord) AS upto
          FROM (VALUES ('open',40,1),('limited',25,2),('numbered',18,3),('allocated',10,4),('atelier',5,5),('singular',2,6)) t(tier, w, ord)
         WHERE EXISTS (SELECT 1 FROM supercargo_catalog c WHERE c.tier = t.tier)) x
       WHERE roll < upto ORDER BY upto LIMIT 1;
      SELECT id INTO pick FROM supercargo_catalog WHERE tier = chosen_tier ORDER BY random() LIMIT 1;
    END IF;
    INSERT INTO supercargo_envelopes (anchor_id, catalog_id, opens_at, closes_at, stock) VALUES (p_anchor, pick, p_opens, p_closes, p_stock);
  END LOOP;
  RETURN p_count;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_stock_envelopes(text, timestamptz, timestamptz, integer, smallint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_stock_envelopes(text, timestamptz, timestamptz, integer, smallint) TO service_role;

-- Commission progress, computed from sightings and claims (an exchange never counts).
CREATE FUNCTION public.supercargo_progress_for(p_member uuid, p_week date)
RETURNS TABLE (commission_id text, title text, have integer, need integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT array_position(ARRAY['open','limited','numbered','allocated','atelier','singular'], tier) AS rank,
           lower(make) AS make, cell_id
      FROM supercargo_sightings
     WHERE spotter = p_member AND credited AND visibility <> 'removed'
       AND captured_at >= p_week AND captured_at < p_week + 7),
  e AS (SELECT count(*)::integer AS n FROM supercargo_envelope_claims
         WHERE member_id = p_member AND claimed_at >= p_week AND claimed_at < p_week + 7)
  SELECT c.id, c.title,
         LEAST(c.target, CASE c.rule->>'kind'
           WHEN 'sightings' THEN (SELECT count(*)::integer FROM s WHERE s.rank >= coalesce(array_position(
             ARRAY['open','limited','numbered','allocated','atelier','singular'], c.rule->>'minTier'), 1))
           WHEN 'distinct_makes' THEN (SELECT count(DISTINCT make)::integer FROM s)
           WHEN 'distinct_cells' THEN (SELECT count(DISTINCT cell_id)::integer FROM s)
           WHEN 'envelopes' THEN (SELECT n FROM e)
           ELSE 0 END),
         c.target::integer
    FROM supercargo_commissions c
   WHERE c.week_start = p_week
   ORDER BY c.id
$$;
REVOKE ALL ON FUNCTION public.supercargo_progress_for(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.supercargo_my_commissions()
RETURNS TABLE (commission_id text, title text, have integer, need integer, marked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.commission_id, p.title, p.have, p.need,
         EXISTS (SELECT 1 FROM supercargo_marks k WHERE k.member_id = public.current_member_id() AND k.commission_id = p.commission_id)
    FROM public.supercargo_progress_for(public.current_member_id(), (date_trunc('week', now() AT TIME ZONE 'UTC'))::date) p
   WHERE public.current_member_id() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.supercargo_my_commissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_my_commissions() TO authenticated;

-- Weekly: record a mark for every completed commission. Service only, idempotent.
CREATE FUNCTION public.supercargo_settle_marks(p_week date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH done AS (
    SELECT m.member_id, p.commission_id
      FROM (SELECT DISTINCT spotter AS member_id FROM supercargo_sightings WHERE captured_at >= p_week AND captured_at < p_week + 7
            UNION SELECT DISTINCT member_id FROM supercargo_envelope_claims WHERE claimed_at >= p_week AND claimed_at < p_week + 7) m
      CROSS JOIN LATERAL public.supercargo_progress_for(m.member_id, p_week) p
     WHERE p.have >= p.need),
  ins AS (INSERT INTO supercargo_marks (member_id, commission_id) SELECT member_id, commission_id FROM done
          ON CONFLICT DO NOTHING RETURNING 1)
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_settle_marks(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_settle_marks(date) TO service_role;

-- A club's combined marks, for its own members. Totals only: no member is ranked.
CREATE FUNCTION public.supercargo_my_club_marks()
RETURNS TABLE (club_id uuid, club_name text, members integer, marks_this_week integer, marks_all_time integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name,
         (SELECT count(*)::integer FROM club_memberships x WHERE x.club_id = c.id),
         (SELECT count(*)::integer FROM supercargo_marks k JOIN supercargo_commissions sc ON sc.id = k.commission_id
           JOIN club_memberships x ON x.member_id = k.member_id AND x.club_id = c.id
          WHERE sc.week_start = (date_trunc('week', now() AT TIME ZONE 'UTC'))::date),
         (SELECT count(*)::integer FROM supercargo_marks k JOIN club_memberships x ON x.member_id = k.member_id AND x.club_id = c.id)
    FROM clubs c
   WHERE EXISTS (SELECT 1 FROM club_memberships me WHERE me.club_id = c.id AND me.member_id = public.current_member_id())
   ORDER BY c.name
$$;
REVOKE ALL ON FUNCTION public.supercargo_my_club_marks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_my_club_marks() TO authenticated;

-- The Exchange, readable. Another member's tradeable folios (only if they have SupercarGO on).
CREATE FUNCTION public.supercargo_tradeable_folios(p_member_number char(6))
RETURNS TABLE (id uuid, owner uuid, make text, model text, tier text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.id, m.id, c.make, c.model, c.tier
    FROM members m
    JOIN supercargo_settings st ON st.member_id = m.id AND st.enabled
    JOIN supercargo_ledger l ON l.member_id = m.id AND l.origin = 'envelope' AND l.acquired_at <= now() - interval '24 hours'
    JOIN supercargo_catalog c ON c.id = l.catalog_id
   WHERE public.current_member_id() IS NOT NULL AND m.member_number = p_member_number
   ORDER BY array_position(ARRAY['singular','atelier','allocated','numbered','limited','open'], c.tier), c.make, c.model
   LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.supercargo_tradeable_folios(char) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_tradeable_folios(char) TO authenticated;

CREATE FUNCTION public.supercargo_my_exchanges()
RETURNS TABLE (id uuid, incoming boolean, other_number char(6), status text, created_at timestamptz, offered jsonb, requested jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT x.id, x.counterparty = public.current_member_id(),
         (SELECT member_number FROM members WHERE id = CASE WHEN x.proposer = public.current_member_id() THEN x.counterparty ELSE x.proposer END),
         x.status, x.created_at,
         (SELECT coalesce(jsonb_agg(jsonb_build_object('make', c.make, 'model', c.model, 'tier', c.tier)), '[]')
            FROM supercargo_ledger l JOIN supercargo_catalog c ON c.id = l.catalog_id WHERE l.id = ANY(x.offered)),
         (SELECT coalesce(jsonb_agg(jsonb_build_object('make', c.make, 'model', c.model, 'tier', c.tier)), '[]')
            FROM supercargo_ledger l JOIN supercargo_catalog c ON c.id = l.catalog_id WHERE l.id = ANY(x.requested))
    FROM supercargo_exchanges x
   WHERE public.current_member_id() IN (x.proposer, x.counterparty)
   ORDER BY (x.status = 'open') DESC, x.created_at DESC
   LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.supercargo_my_exchanges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_my_exchanges() TO authenticated;

-- Housekeeping, service role only: precise points after 30 days, fingerprints after 90.
CREATE FUNCTION public.supercargo_purge() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a integer; b integer;
BEGIN
  DELETE FROM supercargo_sighting_points WHERE purge_after < now();
  GET DIAGNOSTICS a = ROW_COUNT;
  DELETE FROM supercargo_image_hashes WHERE purge_after < now();
  GET DIAGNOSTICS b = ROW_COUNT;
  RETURN a + b;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_purge() TO service_role;

-- Schedules, where pg_cron is available (Supabase: enable it under Database > Extensions).
-- Daily purge at 03:17 UTC; marks settled Mondays 00:20 UTC for the week just ended.
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $q$SELECT cron.schedule('supercargo-purge', '17 3 * * *', 'SELECT public.supercargo_purge()')$q$;
    EXECUTE $q$SELECT cron.schedule('supercargo-settle-marks', '20 0 * * 1',
      'SELECT public.supercargo_settle_marks(((date_trunc(''week'', now() AT TIME ZONE ''UTC''))::date - 7))')$q$;
  ELSE
    RAISE NOTICE 'pg_cron not installed: schedule supercargo_purge() daily and supercargo_settle_marks() weekly elsewhere';
  END IF;
END
$cron$;

-- Privacy flags for one capture, service role only. Answers three questions
-- without exposing any home zone or garage: inside a home zone, the spotter's
-- own car, or a car whose owner opted out (matched by make and model near
-- that owner's home zone, 25 km).
CREATE FUNCTION public.supercargo_privacy_flags(p_member uuid, p_make text, p_model text, p_lng double precision, p_lat double precision)
RETURNS TABLE (near_home boolean, own_car boolean, opted_out boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography AS g)
  SELECT
    EXISTS (SELECT 1 FROM supercargo_home_zones h, p WHERE ST_DWithin(h.zone, p.g, h.radius_m)),
    EXISTS (SELECT 1 FROM vehicles v WHERE v.owner_member_id = p_member
             AND lower(v.make) = lower(p_make) AND lower(v.model) = lower(p_model)),
    EXISTS (SELECT 1 FROM supercargo_optouts o JOIN vehicles v ON v.id = o.vehicle_id
             LEFT JOIN supercargo_home_zones h ON h.member_id = o.owner_member_id, p
             WHERE lower(v.make) = lower(p_make) AND lower(v.model) = lower(p_model)
               AND (h.zone IS NULL OR ST_DWithin(h.zone, p.g, 25000)))
$$;
REVOKE ALL ON FUNCTION public.supercargo_privacy_flags(uuid, text, text, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_privacy_flags(uuid, text, text, double precision, double precision) TO service_role;

-- Admin tools. Admin is members.role = 'admin'. Every function checks it.
CREATE FUNCTION public.supercargo_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM members m WHERE m.id = public.current_member_id() AND m.role = 'admin')
$$;
REVOKE ALL ON FUNCTION public.supercargo_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_is_admin() TO authenticated;

CREATE FUNCTION public.supercargo_require_admin() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.supercargo_is_admin() THEN
    RAISE EXCEPTION 'admins only' USING ERRCODE = 'insufficient_privilege';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_require_admin() FROM PUBLIC, anon, authenticated;

-- Envelope places with what is open at each.
CREATE FUNCTION public.supercargo_admin_anchors()
RETURNS TABLE (id text, name text, kind text, lng double precision, lat double precision, active boolean,
               open_envelopes integer, remaining integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.supercargo_require_admin();
  RETURN QUERY
  SELECT a.id, a.name, a.kind, ST_X(a.point::geometry), ST_Y(a.point::geometry), a.active,
         coalesce(e.n, 0)::integer, coalesce(e.left_over, 0)::integer
    FROM supercargo_anchors a
    LEFT JOIN LATERAL (
      SELECT count(*) AS n, sum(x.stock - x.claimed) AS left_over
        FROM supercargo_envelopes x WHERE x.anchor_id = a.id AND now() < x.closes_at) e ON true
   ORDER BY a.active DESC, a.name;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_admin_anchors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_admin_anchors() TO authenticated;

-- Add or edit a place. Saving it is the review: the admin confirms it is a public place.
CREATE FUNCTION public.supercargo_admin_save_anchor(p_id text, p_name text, p_kind text, p_lng double precision,
  p_lat double precision, p_active boolean, p_public_place boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.supercargo_require_admin();
  IF p_public_place IS NOT TRUE THEN
    RAISE EXCEPTION 'confirm this is a public place, not a residential street' USING ERRCODE = 'check_violation';
  END IF;
  IF p_lng NOT BETWEEN -180 AND 180 OR p_lat NOT BETWEEN -90 AND 90 THEN
    RAISE EXCEPTION 'coordinates' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO supercargo_anchors (id, name, kind, point, reviewed_public, active)
  VALUES (p_id, p_name, p_kind, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, true, coalesce(p_active, true))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, kind = EXCLUDED.kind, point = EXCLUDED.point,
                                 reviewed_public = true, active = EXCLUDED.active;
  RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_admin_save_anchor(text, text, text, double precision, double precision, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_admin_save_anchor(text, text, text, double precision, double precision, boolean, boolean) TO authenticated;

-- Stock a place from now for a number of hours. Contents follow the rarity draw.
CREATE FUNCTION public.supercargo_admin_stock(p_anchor text, p_hours integer, p_count integer, p_stock smallint)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.supercargo_require_admin();
  IF p_hours NOT BETWEEN 1 AND 72 THEN RAISE EXCEPTION 'hours' USING ERRCODE = 'check_violation'; END IF;
  IF NOT EXISTS (SELECT 1 FROM supercargo_anchors a WHERE a.id = p_anchor AND a.active) THEN
    RAISE EXCEPTION 'place is not active' USING ERRCODE = 'check_violation';
  END IF;
  RETURN public.supercargo_stock_envelopes(p_anchor, now(), now() + make_interval(hours => p_hours), p_count, p_stock);
END $$;
REVOKE ALL ON FUNCTION public.supercargo_admin_stock(text, integer, integer, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_admin_stock(text, integer, integer, smallint) TO authenticated;

-- Moderation queue: sightings with reports since their last decision. Reporters stay anonymous.
CREATE FUNCTION public.supercargo_admin_queue()
RETURNS TABLE (sighting_id uuid, make text, model text, tier text, visibility text, hold_reason text,
               captured_on date, photo_path text, reports jsonb, notes text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.supercargo_require_admin();
  RETURN QUERY
  WITH last_decision AS (
    SELECT d.sighting_id, max(d.decided_at) AS at FROM supercargo_moderation d GROUP BY d.sighting_id
  ), open_reports AS (
    SELECT r.* FROM supercargo_reports r LEFT JOIN last_decision l ON l.sighting_id = r.sighting_id
     WHERE l.at IS NULL OR r.created_at > l.at
  ), by_reason AS (
    SELECT o.sighting_id, o.reason, count(*)::integer AS n FROM open_reports o GROUP BY o.sighting_id, o.reason
  )
  SELECT s.id, s.make, s.model, s.tier, s.visibility, s.hold_reason, (s.captured_at AT TIME ZONE 'UTC')::date, s.photo_path,
         (SELECT jsonb_agg(jsonb_build_object('reason', b.reason, 'count', b.n) ORDER BY b.n DESC) FROM by_reason b WHERE b.sighting_id = s.id),
         (SELECT array_agg(o.note ORDER BY o.created_at) FROM open_reports o WHERE o.sighting_id = s.id AND o.note IS NOT NULL)
    FROM supercargo_sightings s
   WHERE s.visibility IN ('held', 'public')
     AND EXISTS (SELECT 1 FROM open_reports o WHERE o.sighting_id = s.id)
   ORDER BY (s.visibility = 'held') DESC, s.captured_at;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_admin_queue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_admin_queue() TO authenticated;

-- A decision always carries a written reason the spotter can read.
CREATE FUNCTION public.supercargo_admin_decide(p_sighting uuid, p_decision text, p_reason text, p_catalog text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  PERFORM public.supercargo_require_admin();
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 3 AND 280 THEN
    RAISE EXCEPTION 'write a reason the spotter can read' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM supercargo_sightings WHERE id = p_sighting) THEN
    RAISE EXCEPTION 'no such sighting' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_decision = 'remove' THEN
    UPDATE supercargo_sightings SET visibility = 'removed', hold_reason = 'moderation' WHERE id = p_sighting;
  ELSIF p_decision = 'restore' THEN
    UPDATE supercargo_sightings SET visibility = 'public', hold_reason = NULL
     WHERE id = p_sighting AND visibility = 'held' AND redaction = 'done' AND credited AND photo_path IS NOT NULL;
  ELSIF p_decision = 'correct_model' THEN
    SELECT * INTO c FROM supercargo_catalog WHERE id = p_catalog;
    IF NOT FOUND THEN RAISE EXCEPTION 'pick a catalog model' USING ERRCODE = 'check_violation'; END IF;
    UPDATE supercargo_sightings SET catalog_id = c.id, make = c.make, model = c.model, tier = c.tier,
           visibility = CASE WHEN visibility = 'held' AND redaction = 'done' AND credited AND photo_path IS NOT NULL THEN 'public' ELSE visibility END,
           hold_reason = CASE WHEN visibility = 'held' THEN NULL ELSE hold_reason END
     WHERE id = p_sighting;
    UPDATE supercargo_ledger SET catalog_id = c.id WHERE sighting_id = p_sighting;
  ELSE
    RAISE EXCEPTION 'decision' USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO supercargo_moderation (sighting_id, decision, reason, decided_by)
  VALUES (p_sighting, p_decision, btrim(p_reason), public.current_member_id());
  RETURN p_decision;
END $$;
REVOKE ALL ON FUNCTION public.supercargo_admin_decide(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_admin_decide(uuid, text, text, text) TO authenticated;

-- What happened to my sightings: holds waiting for review, and every decision with its reason.
CREATE FUNCTION public.supercargo_my_moderation()
RETURNS TABLE (sighting_id uuid, make text, model text, status text, reason text, at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT s.id, s.make, s.model, d.decision, d.reason, d.decided_at
      FROM supercargo_moderation d JOIN supercargo_sightings s ON s.id = d.sighting_id
     WHERE s.spotter = public.current_member_id()
    UNION ALL
    SELECT s.id, s.make, s.model, 'held', 'Taken off the map after a report. A moderator will review it and write the reason here.',
           (SELECT max(r.created_at) FROM supercargo_reports r WHERE r.sighting_id = s.id)
      FROM supercargo_sightings s
     WHERE s.spotter = public.current_member_id() AND s.visibility = 'held' AND s.hold_reason LIKE 'report:%'
  ) x ORDER BY 6 DESC, (x.decision = 'held') DESC LIMIT 50
$$;
REVOKE ALL ON FUNCTION public.supercargo_my_moderation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supercargo_my_moderation() TO authenticated;

-- Redacted photos only. Members read; only the API writes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('supercargo-redacted', 'supercargo-redacted', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY supercargo_redacted_members_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supercargo-redacted' AND public.current_member_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.supercargo_sightings s WHERE s.photo_path = name
      AND (s.spotter = public.current_member_id() OR (s.visibility = 'public' AND now() >= s.publish_at AND now() < s.expires_at)
           OR (s.visibility IN ('held', 'public') AND public.supercargo_is_admin()))));

COMMIT;
