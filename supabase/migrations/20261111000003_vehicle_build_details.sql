BEGIN;
ALTER TABLE public.vehicles ADD COLUMN build_details jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(build_details) = 'object');

CREATE OR REPLACE FUNCTION public.guard_client_vehicle_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF NEW.owner_member_id IS DISTINCT FROM OLD.owner_member_id
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      RAISE EXCEPTION 'vehicle ownership and verification require privileged workflow'
        USING ERRCODE = '42501';
    END IF;
    IF (NEW.year, NEW.make, NEW.model, COALESCE(NEW.trim,''))
       IS DISTINCT FROM (OLD.year, OLD.make, OLD.model, COALESCE(OLD.trim,'')) THEN
      NEW.verification_status := 'unverified';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMIT;
