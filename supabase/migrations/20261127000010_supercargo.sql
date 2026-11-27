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
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supercargo_credit_needs_camera CHECK (NOT credited OR source = 'camera'),
  CONSTRAINT supercargo_public_needs_redaction CHECK (
    visibility <> 'public' OR (source = 'camera' AND credited AND redaction = 'done' AND photo_path IS NOT NULL)),
  CONSTRAINT supercargo_hold_minimum CHECK (publish_at >= captured_at + interval '6 hours'),
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
  kind text NOT NULL CHECK (kind IN ('route_start','route_finish','overlook','venue','museum','event')),
  point geography(Point, 4326) NOT NULL,
  reviewed_public boolean NOT NULL CHECK (reviewed_public),
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.supercargo_anchors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.supercargo_anchors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.supercargo_anchors TO authenticated;
CREATE POLICY supercargo_anchors_members ON public.supercargo_anchors FOR SELECT TO authenticated
  USING (active AND public.current_member_id() IS NOT NULL);

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

-- Housekeeping, service role only: drop precise points after 30 days.
CREATE FUNCTION public.supercargo_purge() RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH gone AS (DELETE FROM supercargo_sighting_points WHERE purge_after < now() RETURNING 1) SELECT count(*)::integer FROM gone
$$;
REVOKE ALL ON FUNCTION public.supercargo_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supercargo_purge() TO service_role;

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

-- Redacted photos only. Members read; only the API writes.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('supercargo-redacted', 'supercargo-redacted', false, 1048576, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;
CREATE POLICY supercargo_redacted_members_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supercargo-redacted' AND public.current_member_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.supercargo_sightings s WHERE s.photo_path = name
      AND (s.spotter = public.current_member_id() OR (s.visibility = 'public' AND now() >= s.publish_at AND now() < s.expires_at))));

COMMIT;
