-- Row Level Security stubs. Refine once auth helpers are wired to members.auth_user_id.

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_mods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ownership_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

-- Helper: resolve calling member id from auth.uid()
CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT id FROM public.members WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.are_friends(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (
        (f.requester_id = a AND f.addressee_id = b)
        OR (f.requester_id = b AND f.addressee_id = a)
      )
  );
$$;

-- Members: read self; service role handles provisioning.
CREATE POLICY members_select_self ON public.members
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY profiles_update_self ON public.profiles
  FOR UPDATE USING (member_id = public.current_member_id());

-- Friendships: participants only.
CREATE POLICY friendships_select_participants ON public.friendships
  FOR SELECT USING (
    requester_id = public.current_member_id()
    OR addressee_id = public.current_member_id()
  );

CREATE POLICY friendships_insert_requester ON public.friendships
  FOR INSERT WITH CHECK (requester_id = public.current_member_id());

CREATE POLICY friendships_update_participants ON public.friendships
  FOR UPDATE USING (
    requester_id = public.current_member_id()
    OR addressee_id = public.current_member_id()
  );

-- Garage: owner always; friends when visibility = friends; public when public.
CREATE POLICY vehicles_select_visible ON public.vehicles
  FOR SELECT USING (
    owner_member_id = public.current_member_id()
    OR visibility = 'public'
    OR (
      visibility = 'friends'
      AND public.are_friends(owner_member_id, public.current_member_id())
    )
  );

CREATE POLICY vehicles_owner_write ON public.vehicles
  FOR ALL USING (owner_member_id = public.current_member_id())
  WITH CHECK (owner_member_id = public.current_member_id());

CREATE POLICY vehicle_mods_select_via_vehicle ON public.vehicle_mods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND (
          v.owner_member_id = public.current_member_id()
          OR v.visibility = 'public'
          OR (
            v.visibility = 'friends'
            AND public.are_friends(v.owner_member_id, public.current_member_id())
          )
        )
    )
  );

CREATE POLICY vehicle_media_select_via_vehicle ON public.vehicle_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id
        AND (
          v.owner_member_id = public.current_member_id()
          OR v.visibility = 'public'
          OR (
            v.visibility = 'friends'
            AND public.are_friends(v.owner_member_id, public.current_member_id())
          )
        )
    )
  );

-- Territories / districts: readable by authenticated; mutations via service role API only.
CREATE POLICY districts_select_auth ON public.districts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY territories_select_auth ON public.territory_definitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ownership_current_select_auth ON public.ownership_current
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ownership_ledger_select_auth ON public.ownership_ledger
  FOR SELECT TO authenticated USING (true);

-- Runs: member can read own runs; writes via API service role.
CREATE POLICY runs_select_own ON public.runs
  FOR SELECT USING (member_id = public.current_member_id());
