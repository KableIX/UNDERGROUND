-- Member-authored page data. Only the following RPCs expose the document.
CREATE TABLE public.member_pages (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 1000000),
  revision integer NOT NULL CHECK (revision > 0)
);
ALTER TABLE public.member_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_pages FROM PUBLIC, anon, authenticated;

-- The legacy profile endpoint and the member page share the same audience.
CREATE FUNCTION public.can_visit_member_page(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.id IS NOT NULL AND (
    v.id = target OR (public.are_friends(v.id,target) AND
      coalesce((SELECT settings->>'audience' FROM public.member_pages WHERE member_id=target),'friends')='friends')
  ) FROM (SELECT public.current_member_id() AS id) v;
$$;
REVOKE ALL ON FUNCTION public.can_visit_member_page(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_visit_member_page(uuid) TO authenticated;
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_member_page_audience ON public.profiles
  FOR SELECT TO authenticated USING (public.can_visit_member_page(member_id));

CREATE FUNCTION public.member_page_connections() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH viewer AS (SELECT public.current_member_id() AS id), contacts AS (
    SELECT DISTINCT m.id,m.display_name,f.status
    FROM viewer v JOIN public.friendships f ON (v.id IN (f.requester_id,f.addressee_id) AND f.status='accepted')
       OR (f.addressee_id=v.id AND f.status='pending')
    JOIN public.members m ON m.id=CASE WHEN f.requester_id=v.id THEN f.addressee_id ELSE f.requester_id END
  )
  SELECT jsonb_build_object(
    'accepted',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name) ORDER BY display_name) FILTER (WHERE status='accepted'),'[]'::jsonb),
    'incoming',coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name) ORDER BY display_name) FILTER (WHERE status='pending'),'[]'::jsonb)
  ) FROM contacts;
$$;

CREATE FUNCTION public.read_member_page(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  viewer uuid := public.current_member_id();
  person public.members%ROWTYPE;
  s jsonb;
  rev integer;
  friends jsonb;
  cars jsonb;
BEGIN
  IF target IS NULL OR NOT public.can_visit_member_page(target) THEN
    RAISE EXCEPTION 'Member page unavailable' USING ERRCODE='42501';
  END IF;
  SELECT * INTO STRICT person FROM public.members WHERE id=target;
  SELECT settings,revision INTO s,rev FROM public.member_pages WHERE member_id=target;
  IF s IS NULL THEN
    SELECT jsonb_build_object('bio',coalesce(p.bio,''),'topEight',to_jsonb(p.top_eight)) INTO s FROM public.profiles p WHERE p.member_id=target;
  END IF;
  s:=coalesce(s,'{}'::jsonb)||jsonb_build_object('displayName',person.display_name);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',m.id,'name',m.display_name) ORDER BY item.ord),'[]'::jsonb) INTO friends
    FROM jsonb_array_elements_text(coalesce(s->'topEight','[]'::jsonb)) WITH ORDINALITY item(id,ord)
    JOIN public.members m ON m.id::text=item.id WHERE public.are_friends(target,m.id);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'label',concat_ws(' ',v.year,v.make,v.model,nullif(v.trim,'')),'visibility',v.visibility)
    ORDER BY v.year,v.make,v.id),'[]'::jsonb) INTO cars FROM public.vehicles v WHERE v.owner_member_id=target
    AND (target=viewer OR (v.id::text=s->>'vehicleId' AND v.visibility IN ('public','friends')));
  s:=s||jsonb_build_object('topEight',coalesce((SELECT jsonb_agg(value->'id') FROM jsonb_array_elements(friends)),'[]'::jsonb));
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cars) x WHERE x->>'id'=s->>'vehicleId') THEN s:=s||'{"vehicleId":null}'; END IF;
  RETURN jsonb_build_object('member',jsonb_build_object('id',person.id,'number',btrim(person.member_number),'name',person.display_name,'founder',person.is_founder),
    'settings',s,'revision',coalesce(rev,0),'vehicles',cars,'featuredFriends',friends,
    'friendCount',(SELECT count(DISTINCT CASE WHEN requester_id=target THEN addressee_id ELSE requester_id END) FROM public.friendships WHERE target IN(requester_id,addressee_id) AND status='accepted'),
    'clout',(SELECT coalesce(sum(delta),0) FROM public.clout_ledger WHERE member_id=target));
END;
$$;

CREATE FUNCTION public.save_member_page(draft jsonb, expected_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  owner_id uuid;
  current_revision integer;
  field text;
  fields text[]:=ARRAY['displayName','bio','status','home','work','linkedin','music','accent','audience','avatar','cover','vehicleId','driveSlug','topEight','layout'];
BEGIN
  SELECT id INTO owner_id FROM public.members WHERE auth_user_id=auth.uid() FOR UPDATE;
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Active membership required' USING ERRCODE='42501'; END IF;
  SELECT revision INTO current_revision FROM public.member_pages WHERE member_id=owner_id;
  IF expected_revision IS DISTINCT FROM coalesce(current_revision,0) THEN RAISE EXCEPTION 'Your page changed. Reload before saving again.' USING ERRCODE='40001'; END IF;
  IF draft IS NULL OR jsonb_typeof(draft)<>'object' OR octet_length(draft::text)>1000000 OR NOT draft ?& fields OR draft-fields<>'{}'::jsonb THEN
    RAISE EXCEPTION 'Invalid member page';
  END IF;
  FOREACH field IN ARRAY ARRAY['displayName','bio','status','home','work','linkedin','music','accent','audience','driveSlug'] LOOP
    IF jsonb_typeof(draft->field)<>'string' THEN RAISE EXCEPTION 'Expected text for %',field; END IF;
  END LOOP;
  IF length(btrim(draft->>'displayName')) NOT BETWEEN 1 AND 64 OR length(draft->>'bio')>500 OR length(draft->>'status')>120 OR length(draft->>'home')>64
     OR length(draft->>'work')>100 OR length(draft->>'driveSlug')>100 OR (draft->>'driveSlug')!~'^[a-z0-9-]*$'
     OR draft->>'accent' NOT IN ('Gold','Ice','Rose','Silver') OR draft->>'audience' NOT IN ('friends','private') THEN RAISE EXCEPTION 'Invalid page details'; END IF;
  IF length(draft->>'linkedin')>350 OR (draft->>'linkedin'<>'' AND (draft->>'linkedin')!~'^https://www[.]linkedin[.]com/in/[a-zA-Z0-9%_-]+$')
    OR length(draft->>'music')>350 OR (draft->>'music'<>'' AND (draft->>'music')!~'^https://(open[.]spotify[.]com/(track|album|playlist)/[a-zA-Z0-9]+/?$|music[.]apple[.]com/[a-z]{2}/(album|song|playlist)/[^[:space:]#]+$)') THEN RAISE EXCEPTION 'Invalid profile link'; END IF;
  FOREACH field IN ARRAY ARRAY['avatar','cover'] LOOP
    IF draft->field <> 'null'::jsonb AND (jsonb_typeof(draft->field)<>'string' OR length(draft->>field)>480000 OR
      left(draft->>field,27)<>'data:image/jpeg;base64,/9j/' OR substr(draft->>field,24) !~ '^[A-Za-z0-9+/]+={0,2}$') THEN RAISE EXCEPTION 'Invalid profile photo'; END IF;
  END LOOP;
  IF jsonb_typeof(draft->'layout')<>'array' OR jsonb_array_length(draft->'layout')<>6 OR NOT (draft->'layout') ?& ARRAY['about','garage','drive','friends','music','work'] THEN RAISE EXCEPTION 'Invalid layout'; END IF;
  IF jsonb_typeof(draft->'topEight')<>'array' OR jsonb_array_length(draft->'topEight')>8 OR
    (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(draft->'topEight'))<>jsonb_array_length(draft->'topEight') OR
    EXISTS(SELECT 1 FROM jsonb_array_elements_text(draft->'topEight') f(id) WHERE f.id IS NULL OR NOT public.are_friends(owner_id,f.id::uuid)) THEN RAISE EXCEPTION 'Choose accepted friends for Top 8'; END IF;
  IF draft->'vehicleId'<>'null'::jsonb AND NOT EXISTS(SELECT 1 FROM public.vehicles WHERE owner_member_id=owner_id AND id::text=draft->>'vehicleId') THEN RAISE EXCEPTION 'Choose a car from your garage'; END IF;
  UPDATE public.members SET display_name=btrim(draft->>'displayName') WHERE id=owner_id;
  INSERT INTO public.member_pages(member_id,settings,revision) VALUES(owner_id,draft,expected_revision+1)
    ON CONFLICT(member_id) DO UPDATE SET settings=excluded.settings,revision=excluded.revision;
END;
$$;

REVOKE ALL ON FUNCTION public.member_page_connections(),public.read_member_page(uuid),public.save_member_page(jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.member_page_connections(),public.read_member_page(uuid),public.save_member_page(jsonb,integer) TO authenticated;
