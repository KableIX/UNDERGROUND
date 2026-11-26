-- V2 keeps the legacy document validated and stores only its additional presentation choices.
CREATE TABLE public.member_page_customizations (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  audience text NOT NULL CHECK (audience IN ('members','friends','private')),
  options jsonb NOT NULL,
  ordering jsonb NOT NULL,
  hidden jsonb NOT NULL,
  large jsonb NOT NULL,
  journal_frames jsonb NOT NULL
);
ALTER TABLE public.member_page_customizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_page_customizations FROM PUBLIC, anon, authenticated;
CREATE UNIQUE INDEX member_page_handle ON public.member_page_customizations(lower(options->>'handle'))
  WHERE coalesce(options->>'handle','') <> '';

CREATE FUNCTION public.valid_member_frame(f jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT CASE WHEN jsonb_typeof(f)='object' AND f ?& ARRAY['mode','x','y'] AND
    f-ARRAY['mode','x','y']='{}' AND f->>'mode' IN ('fill','whole') AND
    jsonb_typeof(f->'x')='number' AND jsonb_typeof(f->'y')='number'
    THEN (f->>'x')::numeric BETWEEN 0 AND 1 AND (f->>'y')::numeric BETWEEN 0 AND 1 ELSE false END
$$;
CREATE FUNCTION public.publish_custom_member_page(draft jsonb, expected_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  owner_id uuid := public.current_member_id();
  opts jsonb := draft->'custom'; layout_v jsonb := draft->'layout'; look_v jsonb := draft->'look';
  hidden_v jsonb := look_v->'hidden'; large_v jsonb := look_v->'large'; who text := draft->>'audience';
  ids text[] := ARRAY['about','garage','drive','friends','music','work','journal','guestbook','collection'];
  required text[] := ARRAY['handle','links','accentColor','panelColor','wallpaper','labels','access','formats','avatarFrame','coverFrame',
     'featureFrame','gallery','owned','showClout','showRuns','showTerritories'];
  legacy jsonb; safe_hidden jsonb; entries_v jsonb; frames_v jsonb; item jsonb; k text;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Sign in' USING ERRCODE='42501'; END IF;
  IF octet_length(draft::text)>12500000 OR who IS NULL OR who NOT IN ('members','friends','private') OR
     jsonb_typeof(opts) IS DISTINCT FROM 'object' OR NOT opts ?& required OR opts-required <> '{}' OR
     jsonb_typeof(layout_v) IS DISTINCT FROM 'array' OR jsonb_array_length(layout_v)<>9 OR NOT layout_v ?& ids THEN
    RAISE EXCEPTION 'Invalid profile customization'; END IF;
  FOREACH item IN ARRAY ARRAY[hidden_v,large_v] LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'array' OR NOT item <@ to_jsonb(ids)
      OR jsonb_array_length(item)<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(item)) THEN RAISE EXCEPTION 'Invalid section list'; END IF;
  END LOOP;
  IF jsonb_typeof(opts->'handle') IS DISTINCT FROM 'string' OR opts->>'handle' !~ '^([a-zA-Z0-9_]{3,24})?$' THEN RAISE EXCEPTION 'Invalid handle'; END IF;
  FOREACH k IN ARRAY ARRAY['accentColor','panelColor'] LOOP
    IF jsonb_typeof(opts->k) IS DISTINCT FROM 'string' OR opts->>k !~ '^(#[A-Fa-f0-9]{6})?$' THEN RAISE EXCEPTION 'Invalid color'; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['showClout','showRuns','showTerritories'] LOOP
    IF jsonb_typeof(opts->k) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid activity preference'; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['avatarFrame','coverFrame','featureFrame'] LOOP
    IF NOT public.valid_member_frame(opts->k) THEN RAISE EXCEPTION 'Invalid photo framing'; END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['labels','access','formats'] LOOP
    IF jsonb_typeof(opts->k) IS DISTINCT FROM 'object' OR (opts->k)-ids <> '{}' OR
      EXISTS(SELECT FROM jsonb_each(opts->k) e WHERE jsonb_typeof(e.value)<>'string'
        OR (k='labels' AND length(e.value#>>'{}')>48)
        OR (k='access' AND e.value#>>'{}' NOT IN ('members','friends','private'))
        OR (k='formats' AND e.value#>>'{}' NOT IN ('compact','full','gallery'))) THEN RAISE EXCEPTION 'Invalid section options'; END IF;
  END LOOP;
  IF jsonb_typeof(opts->'links') IS DISTINCT FROM 'array' OR jsonb_array_length(opts->'links')>6 OR
    EXISTS(SELECT FROM jsonb_array_elements(opts->'links') e WHERE jsonb_typeof(e)<>'string' OR length(e#>>'{}')>350 OR
      e#>>'{}' !~* '^https://[^/[:space:]]+[^[:space:]]*$') THEN RAISE EXCEPTION 'Invalid profile link'; END IF;
  IF jsonb_typeof(opts->'gallery') IS DISTINCT FROM 'array' OR jsonb_array_length(opts->'gallery')>5 OR
     jsonb_typeof(opts->'owned') IS DISTINCT FROM 'array' OR jsonb_array_length(opts->'owned')>12 THEN RAISE EXCEPTION 'Invalid gallery'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements((opts->'gallery') || (opts->'owned') ||
    CASE WHEN opts->'wallpaper'='null' THEN '[]'::jsonb ELSE jsonb_build_array(opts->'wallpaper') END) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT item ?& ARRAY['photo','frame'] OR item-ARRAY['id','photo','frame']<>'{}' OR
       NOT public.valid_member_frame(item->'frame') OR (item->'photo'<>'null' AND
       (jsonb_typeof(item->'photo')<>'string' OR length(item->>'photo')>480000 OR item->>'photo' !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$')) THEN
       RAISE EXCEPTION 'Invalid gallery photo'; END IF;
  END LOOP;
  IF EXISTS(SELECT FROM jsonb_array_elements(opts->'owned') e WHERE NOT EXISTS(SELECT FROM public.vehicles v
     WHERE v.id::text=e->>'id' AND v.owner_member_id=owner_id)) OR jsonb_array_length(opts->'owned') <>
     (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(opts->'owned') e) THEN RAISE EXCEPTION 'Choose a car from your garage'; END IF;
  IF EXISTS(SELECT FROM jsonb_array_elements(draft->'entries') e WHERE e ? 'frame' AND NOT public.valid_member_frame(e->'frame')) THEN
     RAISE EXCEPTION 'Invalid journal frame'; END IF;
  SELECT coalesce(jsonb_agg(value-'frame' ORDER BY ord),'[]'),coalesce(jsonb_agg(value->'frame' ORDER BY ord),'[]')
    INTO entries_v,frames_v FROM jsonb_array_elements(draft->'entries') WITH ORDINALITY j(value,ord);
  SELECT coalesce(jsonb_agg(id ORDER BY n),'[]') INTO safe_hidden FROM unnest(ids) WITH ORDINALITY a(id,n)
    WHERE id<>'collection' AND (hidden_v ? id OR opts->'access'->>id='private');
  legacy := (draft-ARRAY['custom','featuredCar']) || jsonb_build_object('entries',entries_v,'layout',layout_v-'collection',
    'audience',CASE WHEN who='private' THEN 'private' ELSE 'friends' END,
    'look',look_v||jsonb_build_object('hidden',safe_hidden,'large',large_v-'collection'));
  PERFORM public.publish_member_car_feature(legacy,expected_revision,nullif(draft->'featuredCar','null'));
  INSERT INTO public.member_page_customizations VALUES(owner_id,expected_revision+1,who,opts,layout_v,hidden_v,large_v,frames_v)
    ON CONFLICT(member_id) DO UPDATE SET revision=excluded.revision,audience=excluded.audience,options=excluded.options,
      ordering=excluded.ordering,hidden=excluded.hidden,large=excluded.large,journal_frames=excluded.journal_frames;
END $$;

CREATE FUNCTION public.read_custom_member_page(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE
  who uuid := public.current_member_id(); mine boolean := who=target; friend boolean := false;
  m public.members%ROWTYPE; b public.member_pages%ROWTYPE; d public.member_page_designs%ROWTYPE;
  c public.member_page_customizations%ROWTYPE; opts jsonb; s jsonb; blocked jsonb := '[]'; k text;
  ids text[] := ARRAY['about','garage','drive','friends','music','work','journal','guestbook','collection'];
  cars jsonb; friends jsonb; entries_v jsonb; feature jsonb; owned jsonb; accepted_count integer;
BEGIN
  IF who IS NULL THEN RAISE EXCEPTION 'Sign in' USING ERRCODE='42501'; END IF;
  SELECT * INTO b FROM public.member_pages WHERE member_id=target;
  SELECT * INTO c FROM public.member_page_customizations WHERE member_id=target AND revision=b.revision;
  IF NOT FOUND THEN RETURN public.read_designed_member_page(target); END IF;
  friend := coalesce(public.are_friends(who,target),false);
  IF NOT mine AND (c.audience='private' OR (c.audience='friends' AND NOT friend)) THEN
    RAISE EXCEPTION 'Member page unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO STRICT m FROM public.members WHERE id=target;
  SELECT * INTO STRICT d FROM public.member_page_designs WHERE member_id=target;
  opts:=c.options;
  SELECT coalesce(jsonb_agg(id ORDER BY n),'[]') INTO blocked FROM unnest(ids) WITH ORDINALITY a(id,n)
    WHERE c.hidden ? id OR (NOT mine AND (opts->'access'->>id='private' OR (opts->'access'->>id='friends' AND NOT friend)));
  SELECT coalesce(jsonb_agg(CASE WHEN jsonb_typeof(c.journal_frames->(ord::int-1))='object'
     THEN value||jsonb_build_object('frame',c.journal_frames->(ord::int-1)) ELSE value END ORDER BY ord),'[]')
    INTO entries_v FROM jsonb_array_elements(d.entries) WITH ORDINALITY j(value,ord);
  s:=b.settings||jsonb_build_object('displayName',m.display_name,'audience',c.audience,'layout',c.ordering,
    'look',d.look||jsonb_build_object('hidden',blocked,'large',c.large),'entries',entries_v,'trackTitle',d.track_title,
    'music',coalesce(nullif(d.direct_audio,''),b.settings->>'music'));
  SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO owned FROM jsonb_array_elements(opts->'owned') WITH ORDINALITY a(value,ord)
    JOIN public.vehicles v ON v.id::text=value->>'id' AND v.owner_member_id=target
    WHERE mine OR (NOT blocked ? 'collection' AND (v.visibility='public' OR (friend AND v.visibility='friends')));
  opts:=jsonb_set(opts,'{owned}',owned);
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',v.id,'label',concat_ws(' ',v.year,v.make,v.model,nullif(v.trim,'')),'visibility',v.visibility)
     ORDER BY v.year,v.make,v.id),'[]') INTO cars FROM public.vehicles v WHERE v.owner_member_id=target AND (mine OR
     ((v.visibility='public' OR (friend AND v.visibility='friends')) AND
     ((NOT blocked ? 'garage' AND v.id::text=s->>'vehicleId') OR EXISTS(SELECT FROM jsonb_array_elements(owned) o WHERE o->>'id'=v.id::text))));
  feature:=d.featured_car;
  IF (NOT mine AND blocked ? 'garage') OR (s->>'vehicleId' IS NOT NULL AND NOT EXISTS(SELECT FROM jsonb_array_elements(cars) v WHERE v->>'id'=s->>'vehicleId')) THEN
    s:=s||'{"vehicleId":null}'; feature:=NULL; opts:=jsonb_set(opts,'{gallery}','[]');
  END IF;
  IF NOT mine THEN
    FOR k IN SELECT value FROM jsonb_array_elements_text(blocked) LOOP
      opts:=jsonb_set(jsonb_set(opts,'{labels}',(opts->'labels')-k),'{formats}',(opts->'formats')-k);
    END LOOP;
    IF blocked ? 'journal' THEN s:=s||'{"entries":[]}'; END IF;
    IF blocked ? 'work' THEN s:=s||'{"work":"","linkedin":""}'; END IF;
    IF blocked ? 'drive' THEN s:=s||'{"driveSlug":""}'; END IF;
    IF blocked ? 'about' THEN s:=s||'{"bio":""}'; opts:=jsonb_set(opts,'{links}','[]'); END IF;
    IF blocked ? 'music' THEN s:=s||'{"music":"","trackTitle":""}'; END IF;
    IF blocked ? 'friends' THEN s:=s||'{"topEight":[]}'; END IF;
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) ORDER BY ord),'[]')
    INTO friends FROM jsonb_array_elements_text(s->'topEight') WITH ORDINALITY a(id,ord) JOIN public.members p
    ON p.id::text=a.id WHERE public.are_friends(target,p.id);
  SELECT count(*) INTO accepted_count FROM public.friendships WHERE target IN(requester_id,addressee_id) AND status='accepted';
  RETURN jsonb_build_object('settings',s||jsonb_build_object('custom',opts,'featuredCar',feature,
    'topEight',coalesce((SELECT jsonb_agg(f->'id') FROM jsonb_array_elements(friends) f),'[]')),
    'revision',b.revision,'vehicles',cars,'friendCount',accepted_count,'featuredFriends',friends,
    'member',jsonb_build_object('id',m.id,'number',btrim(m.member_number),'name',m.display_name,'founder',m.is_founder),
    'clout',CASE WHEN mine OR (opts->>'showClout')::boolean THEN (SELECT coalesce(sum(delta),0) FROM public.clout_ledger WHERE member_id=target) END,
    'verifiedRuns',CASE WHEN mine OR (opts->>'showRuns')::boolean THEN (SELECT count(*) FROM public.runs WHERE member_id=target AND state='ACCEPTED' AND evidence_source='production') END,
    'territories',CASE WHEN mine OR (opts->>'showTerritories')::boolean THEN (SELECT count(*) FROM public.ownership_current WHERE owner_id=target AND track='solo') END);
END $$;

CREATE OR REPLACE FUNCTION public.can_visit_guestbook(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT CASE WHEN c.member_id IS NULL THEN public.can_visit_member_page(target) AND NOT EXISTS(
      SELECT FROM public.member_page_designs WHERE member_id=target AND look->'hidden' ? 'guestbook')
    ELSE v.id IS NOT NULL AND NOT c.hidden ? 'guestbook' AND (v.id=target OR
      ((c.audience='members' OR (c.audience='friends' AND public.are_friends(v.id,target))) AND
       (coalesce(c.options#>>'{access,guestbook}','members')='members' OR
       (c.options#>>'{access,guestbook}'='friends' AND public.are_friends(v.id,target))))) END
  FROM (SELECT public.current_member_id() id) v LEFT JOIN public.member_pages b ON b.member_id=target
  LEFT JOIN public.member_page_customizations c ON c.member_id=target AND c.revision=b.revision
$$;
CREATE OR REPLACE FUNCTION public.profile_featured_garage(target uuid,car uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('label',concat_ws(' ',v.year,v.make,v.model,v.trim),'color',v.color,'mods',
   (SELECT coalesce(jsonb_agg(jsonb_build_object('title',m.title,'status',m.status) ORDER BY m.title,m.id),'[]') FROM public.vehicle_mods m WHERE m.vehicle_id=v.id))
 FROM public.vehicles v, LATERAL (SELECT public.read_custom_member_page(target) p) a WHERE v.id=car AND v.owner_member_id=target
 AND a.p#>>'{settings,vehicleId}'=v.id::text
$$;
REVOKE ALL ON FUNCTION public.valid_member_frame(jsonb),public.read_custom_member_page(uuid),public.publish_custom_member_page(jsonb,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_custom_member_page(uuid),public.publish_custom_member_page(jsonb,integer) TO authenticated;

CREATE FUNCTION public.find_visible_member_page(number_input text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id FROM public.members m
 LEFT JOIN public.member_pages b ON b.member_id=m.id
 LEFT JOIN public.member_page_customizations c ON c.member_id=m.id AND c.revision=b.revision
 WHERE number_input ~ '^[0-9]{6}$' AND m.member_number=number_input AND public.current_member_id() IS NOT NULL
 AND (public.can_visit_member_page(m.id) OR c.audience='members')
$$;
REVOKE ALL ON FUNCTION public.find_visible_member_page(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.find_visible_member_page(text) TO authenticated;
