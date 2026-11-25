-- Private, short-lived observations. Never a police-location feed or gameplay input.
CREATE TABLE public.club_radar_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_event_id uuid NOT NULL,
  reporter_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('radar','police_visual')),
  source text NOT NULL CHECK (source IN ('manual','uniden_r8','uniden_r8w')),
  band text CHECK (band IN ('X','K','KA','K POP','KA POP','LASER','MRCD','MRCT','RT3','RT4')),
  strength integer CHECK (strength BETWEEN 1 AND 8),
  direction text CHECK (direction IN ('front','side','rear')),
  frequency_ghz double precision CHECK (frequency_ghz > 0 AND frequency_ghz < 100),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 100),
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (reporter_id, client_event_id),
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '10 minutes'),
  CHECK ((source = 'manual' AND band IS NULL AND strength IS NULL AND direction IS NULL AND frequency_ghz IS NULL)
    OR (source <> 'manual' AND kind = 'radar' AND band IS NOT NULL AND strength IS NOT NULL AND direction IS NOT NULL)),
  CHECK (band IN ('X','K','KA','K POP','KA POP') OR frequency_ghz IS NULL)
);
CREATE INDEX club_radar_recent ON public.club_radar_reports(club_id, expires_at DESC);
CREATE INDEX club_radar_rate ON public.club_radar_reports(reporter_id, created_at DESC);

CREATE TABLE public.club_radar_confirmations (
  report_id uuid NOT NULL REFERENCES public.club_radar_reports(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('still_present','gone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, member_id)
);

ALTER TABLE public.club_radar_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_radar_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_radar_reports, public.club_radar_confirmations FROM anon, authenticated;
GRANT SELECT ON public.club_radar_reports, public.club_radar_confirmations TO authenticated;

CREATE POLICY club_radar_read_members ON public.club_radar_reports FOR SELECT TO authenticated USING (
  expires_at > now()
  AND EXISTS (SELECT 1 FROM public.club_memberships cm WHERE cm.club_id = club_radar_reports.club_id AND cm.member_id = public.current_member_id())
  AND EXISTS (SELECT 1 FROM public.club_memberships cm WHERE cm.club_id = club_radar_reports.club_id AND cm.member_id = club_radar_reports.reporter_id)
);
CREATE POLICY club_radar_confirmations_read_members ON public.club_radar_confirmations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.club_radar_reports r JOIN public.club_memberships cm ON cm.club_id = r.club_id
    WHERE r.id = club_radar_confirmations.report_id AND cm.member_id = club_radar_confirmations.member_id)
);

CREATE FUNCTION public.submit_club_radar(
  p_club_id uuid, p_event_id uuid, p_kind text, p_source text,
  p_latitude double precision, p_longitude double precision, p_accuracy_m double precision, p_observed_at timestamptz,
  p_band text DEFAULT NULL, p_strength integer DEFAULT NULL, p_direction text DEFAULT NULL, p_frequency_ghz double precision DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := public.current_member_id(); existing_id uuid; new_id uuid;
BEGIN
  IF caller IS NULL OR NOT EXISTS (SELECT 1 FROM public.club_memberships WHERE club_id = p_club_id AND member_id = caller) THEN
    RAISE EXCEPTION 'club_membership_required' USING ERRCODE = '42501';
  END IF;
  -- Serialize a member's writes across clubs so concurrent requests cannot evade rate limiting.
  PERFORM pg_advisory_xact_lock(hashtextextended(caller::text, 4701));
  SELECT id INTO existing_id FROM public.club_radar_reports WHERE reporter_id = caller AND client_event_id = p_event_id AND club_id = p_club_id;
  IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
  IF p_observed_at IS NULL OR p_observed_at < now() - interval '15 seconds' OR p_observed_at > now() + interval '2 seconds' THEN
    RAISE EXCEPTION 'fresh_location_required' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.club_radar_reports WHERE reporter_id = caller AND created_at > now() - interval '10 seconds') THEN
    RAISE EXCEPTION 'report_rate_limited' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.club_radar_reports(client_event_id, reporter_id, club_id, kind, source, band, strength, direction, frequency_ghz,
    latitude, longitude, accuracy_m, observed_at, expires_at)
  VALUES (p_event_id, caller, p_club_id, p_kind, p_source, p_band, p_strength, p_direction, p_frequency_ghz,
    p_latitude, p_longitude, p_accuracy_m, p_observed_at, now() + CASE WHEN p_kind = 'police_visual' THEN interval '10 minutes' ELSE interval '5 minutes' END)
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

CREATE FUNCTION public.confirm_club_radar(p_report_id uuid, p_vote text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := public.current_member_id();
BEGIN
  IF caller IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.club_radar_reports r
    JOIN public.club_memberships cm ON cm.club_id = r.club_id AND cm.member_id = caller
    JOIN public.club_memberships author ON author.club_id = r.club_id AND author.member_id = r.reporter_id
    WHERE r.id = p_report_id AND r.reporter_id <> caller AND r.expires_at > now()
  ) THEN RAISE EXCEPTION 'eligible_report_required' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.club_radar_confirmations(report_id,member_id,vote) VALUES(p_report_id,caller,p_vote)
  ON CONFLICT(report_id,member_id) DO UPDATE SET vote = excluded.vote, created_at = now();
END $$;

REVOKE ALL ON FUNCTION public.submit_club_radar(uuid,uuid,text,text,double precision,double precision,double precision,timestamptz,text,integer,text,double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_club_radar(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_club_radar(uuid,uuid,text,text,double precision,double precision,double precision,timestamptz,text,integer,text,double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_club_radar(uuid,text) TO authenticated;

-- Operator maintenance: expiry hides rows immediately; scheduled purge removes GPS history.
CREATE FUNCTION public.purge_expired_club_radar() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE removed bigint;
BEGIN
  DELETE FROM public.club_radar_reports WHERE expires_at <= now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.purge_expired_club_radar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_club_radar() TO service_role;
