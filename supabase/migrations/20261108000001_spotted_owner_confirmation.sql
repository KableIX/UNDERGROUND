BEGIN;
CREATE TABLE public.spotted_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spotter uuid NOT NULL DEFAULT public.current_member_id() REFERENCES public.members(id) ON DELETE CASCADE,
  sighting text NOT NULL CHECK (sighting ~ '^spot-[a-z0-9-]{1,80}$'),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  context text NOT NULL CHECK (length(context) <= 340),
  thumbnail text NOT NULL CHECK (length(thumbnail) BETWEEN 8 AND 200000 AND left(thumbnail,4) = '/9j/'),
  decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending','confirmed','declined')),
  owner_number char(6),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(spotter,sighting)
);
CREATE INDEX spotted_confirmations_vehicle ON public.spotted_confirmations(vehicle_id);
ALTER TABLE public.spotted_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spotted_confirmations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.spotted_confirmations TO authenticated;
GRANT INSERT(sighting,vehicle_id,context,thumbnail) ON public.spotted_confirmations TO authenticated;
GRANT UPDATE(decision,owner_number) ON public.spotted_confirmations TO authenticated;
CREATE POLICY spotted_read ON public.spotted_confirmations FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND
    (spotter=public.current_member_id() OR v.owner_member_id=public.current_member_id()))
);
CREATE POLICY spotted_request ON public.spotted_confirmations FOR INSERT TO authenticated WITH CHECK (
  spotter=public.current_member_id() AND decision='pending' AND owner_number IS NULL
  AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.owner_member_id<>spotter)
);
CREATE POLICY spotted_decide ON public.spotted_confirmations FOR UPDATE TO authenticated USING (
  decision='pending' AND EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.owner_member_id=public.current_member_id())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.vehicles v WHERE v.id=vehicle_id AND v.owner_member_id=public.current_member_id())
  AND ((decision='confirmed' AND owner_number=(SELECT member_number FROM public.members WHERE id=public.current_member_id()))
       OR (decision='declined' AND owner_number IS NULL))
);
COMMIT;
