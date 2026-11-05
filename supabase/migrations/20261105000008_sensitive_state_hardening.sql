-- Harden sensitive state transitions before enabling client persistence.
-- Apply to a disposable Supabase environment first; this migration has not been DB-executed.
DROP POLICY IF EXISTS friendships_update_participants ON public.friendships;
CREATE POLICY friendships_update_addressee ON public.friendships
  FOR UPDATE TO authenticated
  USING (addressee_id = public.current_member_id())
  WITH CHECK (addressee_id = public.current_member_id());

CREATE OR REPLACE FUNCTION public.guard_client_vehicle_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.owner_member_id IS DISTINCT FROM OLD.owner_member_id
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'vehicle ownership and verification require privileged workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- The owner-write RLS policy also permits INSERT, so protect initial verification.
CREATE OR REPLACE FUNCTION public.guard_client_vehicle_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NEW.verification_status <> 'unverified' THEN
    RAISE EXCEPTION 'client-created vehicles must start unverified'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_client_vehicle_insert ON public.vehicles;
CREATE TRIGGER guard_client_vehicle_insert
BEFORE INSERT ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.guard_client_vehicle_insert();

DROP TRIGGER IF EXISTS guard_client_vehicle_update ON public.vehicles;
CREATE TRIGGER guard_client_vehicle_update
BEFORE UPDATE ON public.vehicles
FOR EACH ROW EXECUTE FUNCTION public.guard_client_vehicle_update();

CREATE OR REPLACE FUNCTION public.guard_client_friendship_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
       OR NEW.addressee_id IS DISTINCT FROM OLD.addressee_id
       OR NEW.status NOT IN ('accepted', 'rejected')
       OR OLD.status <> 'pending' THEN
      RAISE EXCEPTION 'friendship update must be a recipient decision on a pending request'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Requesters must not insert already-accepted friendships.
CREATE OR REPLACE FUNCTION public.guard_client_friendship_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND NEW.status <> 'pending' THEN
    RAISE EXCEPTION 'client friendship requests must start pending'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_client_friendship_insert ON public.friendships;
CREATE TRIGGER guard_client_friendship_insert
BEFORE INSERT ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.guard_client_friendship_insert();

DROP TRIGGER IF EXISTS guard_client_friendship_update ON public.friendships;
CREATE TRIGGER guard_client_friendship_update
BEFORE UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.guard_client_friendship_update();

-- Client profile updates cannot forge social counters or claim arbitrary Top 8 entries.
-- Dedicated authorized RPCs must manage social denormalizations and Top 8.
CREATE OR REPLACE FUNCTION public.guard_client_profile_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.member_id IS DISTINCT FROM OLD.member_id
       OR NEW.friend_count IS DISTINCT FROM OLD.friend_count
       OR NEW.follower_count IS DISTINCT FROM OLD.follower_count
       OR NEW.top_eight IS DISTINCT FROM OLD.top_eight THEN
      RAISE EXCEPTION 'social counters and Top 8 require authorized server workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_client_profile_update ON public.profiles;
CREATE TRIGGER guard_client_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_client_profile_update();

COMMENT ON FUNCTION public.guard_client_vehicle_update() IS
  'Blocks authenticated clients from self-verifying or transferring vehicle ownership';
COMMENT ON FUNCTION public.guard_client_friendship_update() IS
  'Only the recipient may accept/reject a pending request; privileged services handle other transitions';
