BEGIN;
-- Trusted administration enrolls clubs for private drives.
CREATE TABLE public.drive_verified_clubs (club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE);
REVOKE ALL ON public.drive_verified_clubs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.drive_verified_clubs TO authenticated;
ALTER TABLE public.drive_verified_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY verified_club_read ON public.drive_verified_clubs FOR SELECT TO authenticated USING
(EXISTS (SELECT 1 FROM public.club_memberships m WHERE m.club_id=drive_verified_clubs.club_id AND m.member_id=public.current_member_id()));

CREATE FUNCTION public.drive_member(c uuid, organizer boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.club_memberships m JOIN public.drive_verified_clubs v USING(club_id)
 WHERE m.club_id=c AND m.member_id=public.current_member_id() AND (NOT organizer OR m.role IN ('officer','owner')))
$$;

CREATE TABLE public.club_drive_routes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 title text NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 100),
 roads text NOT NULL CHECK(length(trim(roads)) BETWEEN 1 AND 1500),
 meet text NOT NULL CHECK(length(trim(meet)) BETWEEN 1 AND 200),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=800),
 coordinates jsonb NOT NULL, distance_m integer NOT NULL CHECK(distance_m>0),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,id)
);
ALTER TABLE public.club_drive_routes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_drive_routes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.club_drive_routes TO authenticated;
CREATE POLICY drive_route_read ON public.club_drive_routes FOR SELECT TO authenticated USING (public.drive_member(club_id));

-- Route rows are immutable revisions. Only road-following LineStrings can be saved.
CREATE FUNCTION public.save_club_drive(c uuid, title_text text, roads_text text, meet_text text, notes_text text, points jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved uuid; meters integer;
BEGIN
 IF NOT public.drive_member(c,true) THEN RAISE EXCEPTION 'Organizer membership required'; END IF;
 IF jsonb_typeof(points) IS DISTINCT FROM 'array' OR jsonb_array_length(points) NOT BETWEEN 2 AND 20000 THEN RAISE EXCEPTION 'Invalid route'; END IF;
 IF EXISTS(SELECT FROM jsonb_array_elements(points) p WHERE jsonb_typeof(p)<>'array' OR jsonb_array_length(p)<>2
   OR jsonb_typeof(p->0)<>'number' OR jsonb_typeof(p->1)<>'number'
   OR (p->>0)::numeric NOT BETWEEN -180 AND 180 OR (p->>1)::numeric NOT BETWEEN -90 AND 90) THEN RAISE EXCEPTION 'Invalid coordinates'; END IF;
 SELECT round(sum(12742000 * asin(sqrt(least(1.0,
   sin((lat-prev_lat)/2)^2 + cos(lat)*cos(prev_lat)*sin((lon-prev_lon)/2)^2))))) INTO meters
 FROM (SELECT lat,lon,lag(lat) OVER(ORDER BY n) prev_lat,lag(lon) OVER(ORDER BY n) prev_lon
 FROM (SELECT n,radians((p->>1)::float8) lat,radians((p->>0)::float8) lon
 FROM jsonb_array_elements(points) WITH ORDINALITY AS pts(p,n)) coords) segments WHERE prev_lat IS NOT NULL;
 INSERT INTO public.club_drive_routes(club_id,title,roads,meet,notes,coordinates,distance_m)
 VALUES(c,trim(title_text),trim(roads_text),trim(meet_text),trim(notes_text),points,meters) RETURNING id INTO saved;
 RETURN saved;
END $$;
ALTER TABLE public.club_events ADD COLUMN drive_route_id uuid, ADD COLUMN meet_at timestamptz,
 ADD COLUMN event_tz text, ADD COLUMN cancelled boolean NOT NULL DEFAULT false,
 ADD CONSTRAINT club_event_route_fk FOREIGN KEY(club_id,drive_route_id) REFERENCES public.club_drive_routes(club_id,id),
 ADD CONSTRAINT drive_meet_before_departure CHECK(drive_route_id IS NULL OR (meet_at IS NOT NULL AND meet_at<=starts_at AND event_tz IS NOT NULL));
DROP POLICY club_events_select_auth ON public.club_events;
CREATE POLICY club_events_select_member ON public.club_events FOR SELECT TO authenticated USING
((drive_route_id IS NULL AND EXISTS(SELECT 1 FROM public.club_memberships m WHERE m.club_id=club_events.club_id AND m.member_id=public.current_member_id()))
 OR public.drive_member(club_id));

CREATE FUNCTION public.schedule_club_drive(route uuid, meeting timestamptz, departure timestamptz, zone text, occurrence uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.club_drive_routes; existing public.club_events;
BEGIN
 SELECT * INTO r FROM public.club_drive_routes WHERE id=route;
 IF r.id IS NULL OR NOT public.drive_member(r.club_id,true) THEN RAISE EXCEPTION 'Organizer membership required'; END IF;
 IF meeting IS NULL OR departure IS NULL OR meeting<now() OR departure<meeting OR NOT EXISTS(SELECT FROM pg_catalog.pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'Invalid event time'; END IF;
 IF occurrence IS NULL THEN
 INSERT INTO public.club_events(club_id,created_by_member_id,title,starts_at,location_label,drive_route_id,meet_at,event_tz)
 VALUES(r.club_id,public.current_member_id(),r.title,departure,r.meet,route,meeting,zone) RETURNING id INTO occurrence;
 ELSE
 SELECT * INTO existing FROM public.club_events WHERE id=occurrence AND drive_route_id=route AND NOT cancelled AND starts_at>now() FOR UPDATE;
 IF existing.id IS NULL THEN RAISE EXCEPTION 'Departure unavailable'; END IF;
 UPDATE public.club_events SET starts_at=departure,meet_at=meeting,event_tz=zone WHERE id=occurrence;
 END IF;
 RETURN occurrence;
END $$;
CREATE FUNCTION public.cancel_club_drive(occurrence uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.club_events SET cancelled=true WHERE id=occurrence AND drive_route_id IS NOT NULL AND starts_at>now() AND public.drive_member(club_id,true);
 IF NOT FOUND THEN RAISE EXCEPTION 'Departure unavailable'; END IF;
END $$;

CREATE TABLE public.club_drive_rsvps (
 event_id uuid NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
 member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
 driver_name text NOT NULL, car text NOT NULL, entry_class text NOT NULL CHECK(entry_class IN ('Daily','Collector')),
 PRIMARY KEY(event_id,member_id)
);
ALTER TABLE public.club_drive_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_drive_rsvps FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.club_drive_rsvps TO authenticated;
CREATE POLICY drive_roster_read ON public.club_drive_rsvps FOR SELECT TO authenticated USING
(EXISTS(SELECT FROM public.club_events e WHERE e.id=event_id AND public.drive_member(e.club_id)));

CREATE FUNCTION public.rsvp_club_drive(occurrence uuid, vehicle uuid, class text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.club_events; me uuid:=public.current_member_id(); v public.vehicles;
BEGIN
 SELECT * INTO e FROM public.club_events WHERE id=occurrence AND drive_route_id IS NOT NULL FOR UPDATE;
 IF e.id IS NULL OR NOT public.drive_member(e.club_id) OR e.cancelled OR e.starts_at<=now() THEN RAISE EXCEPTION 'Departure unavailable'; END IF;
 IF vehicle IS NULL THEN DELETE FROM public.club_drive_rsvps WHERE event_id=e.id AND member_id=me; RETURN; END IF;
 SELECT * INTO v FROM public.vehicles WHERE id=vehicle AND owner_member_id=me;
 IF v.id IS NULL THEN RAISE EXCEPTION 'Choose a vehicle in your garage'; END IF;
 INSERT INTO public.club_drive_rsvps(event_id,member_id,vehicle_id,driver_name,car,entry_class)
 SELECT e.id,me,v.id,m.display_name,concat_ws(' ',v.year,v.make,v.model,v.trim),class FROM public.members m WHERE m.id=me
 ON CONFLICT(event_id,member_id) DO UPDATE SET vehicle_id=excluded.vehicle_id,car=excluded.car,entry_class=excluded.entry_class,driver_name=excluded.driver_name;
END $$;
REVOKE ALL ON FUNCTION public.save_club_drive(uuid,text,text,text,text,jsonb),public.schedule_club_drive(uuid,timestamptz,timestamptz,text,uuid),public.cancel_club_drive(uuid),public.rsvp_club_drive(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_club_drive(uuid,text,text,text,text,jsonb),public.schedule_club_drive(uuid,timestamptz,timestamptz,text,uuid),public.cancel_club_drive(uuid),public.rsvp_club_drive(uuid,uuid,text) TO authenticated;
COMMIT;
