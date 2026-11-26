ALTER TABLE public.member_page_designs ADD COLUMN featured_car jsonb;

CREATE FUNCTION public.publish_member_car_feature(draft jsonb, expected_revision integer, feature jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF feature IS NOT NULL AND (
    jsonb_typeof(feature) IS DISTINCT FROM 'object'
    OR jsonb_typeof(feature->'name') IS DISTINCT FROM 'string'
    OR jsonb_typeof(feature->'story') IS DISTINCT FROM 'string'
    OR length(btrim(feature->>'name')) NOT BETWEEN 1 AND 100
    OR length(feature->>'story') > 500 OR (feature->>'linkedVehicleId') IS DISTINCT FROM (draft->>'vehicleId')
    OR (feature ? 'photo' AND feature->'photo' <> 'null'::jsonb AND
      (jsonb_typeof(feature->'photo') <> 'string' OR length(feature->>'photo') > 480000
       OR feature->>'photo' !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$'))
    OR feature - ARRAY['name','story','photo','linkedVehicleId'] <> '{}'::jsonb
  ) THEN RAISE EXCEPTION 'Invalid featured car'; END IF;
  PERFORM public.publish_member_profile(draft,expected_revision);
  UPDATE public.member_page_designs SET featured_car=feature WHERE member_id=public.current_member_id();
END $$;

ALTER FUNCTION public.read_designed_member_page(uuid) RENAME TO read_member_page_without_car_feature;
REVOKE ALL ON FUNCTION public.read_member_page_without_car_feature(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.read_designed_member_page(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  p jsonb := public.read_member_page_without_car_feature(target);
  feature jsonb;
BEGIN
  SELECT featured_car INTO feature FROM public.member_page_designs WHERE member_id=target;
  IF feature IS NOT NULL AND (feature->>'linkedVehicleId') IS NOT DISTINCT FROM (p#>>'{settings,vehicleId}') AND
    (target=public.current_member_id() OR NOT (p#>'{settings,look,hidden}' ? 'garage')) THEN
    RETURN jsonb_set(p,'{settings,featuredCar}',feature);
  END IF;
  RETURN p;
END $$;
REVOKE ALL ON FUNCTION public.publish_member_car_feature(jsonb,integer,jsonb),public.read_designed_member_page(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_member_car_feature(jsonb,integer,jsonb),public.read_designed_member_page(uuid) TO authenticated;
