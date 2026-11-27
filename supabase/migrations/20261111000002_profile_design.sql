-- Presentation is versioned by the same row lock and revision as the member's profile.
CREATE TABLE public.member_page_designs (
  member_id uuid PRIMARY KEY REFERENCES public.members(id) ON DELETE CASCADE,
  look jsonb NOT NULL,
  ordering jsonb NOT NULL,
  entries jsonb NOT NULL,
  direct_audio text NOT NULL,
  track_title text NOT NULL
);
CREATE TABLE public.member_guestbook (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body text NOT NULL CHECK(length(btrim(body)) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(owner_id <> author_id)
);
CREATE INDEX member_guestbook_page ON public.member_guestbook (owner_id,created_at DESC,id DESC);
ALTER TABLE public.member_page_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_guestbook ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_page_designs,public.member_guestbook FROM PUBLIC,anon,authenticated;

-- The original profiles table exposes a legacy bio and Top 8 together. The
-- member-page API can redact individual fields, while raw legacy reads cannot.
CREATE FUNCTION public.can_read_legacy_profile(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT public.can_visit_member_page(target) AND (
    target=public.current_member_id() OR NOT EXISTS (
      SELECT FROM public.member_page_designs
      WHERE member_id=target AND (look->'hidden') ?| ARRAY['about','friends']
    )
  )
$$;
REVOKE ALL ON FUNCTION public.can_read_legacy_profile(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_legacy_profile(uuid) TO authenticated;
ALTER POLICY profiles_select_member_page_audience ON public.profiles USING (public.can_read_legacy_profile(member_id));

CREATE FUNCTION public.publish_member_profile(draft jsonb,expected_revision integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  fields text[]:=ARRAY['about','garage','drive','friends','music','work','journal','guestbook'];
  look jsonb:=draft->'look';
  core jsonb:=draft-ARRAY['look','entries','trackTitle'];
  item jsonb;
  audio text:='';
BEGIN
  IF NOT draft ?& ARRAY['look','entries','trackTitle','layout','music'] OR
     jsonb_typeof(draft->'layout') IS DISTINCT FROM 'array' OR jsonb_array_length(draft->'layout')<>8 OR
     NOT (draft->'layout') ?& fields THEN RAISE EXCEPTION 'Invalid layout'; END IF;
  IF jsonb_typeof(look) IS DISTINCT FROM 'object' OR NOT look ?& ARRAY['wallpaper','heading','panels','coverSize','hidden'] OR
    (look-ARRAY['wallpaper','heading','panels','coverSize','hidden','large']) <> '{}'::jsonb OR
    NOT coalesce((look->>'wallpaper') IN ('Midnight','Saratoga','Pacific','My cover') AND (look->>'heading') IN ('Condensed','Classic','Modern')
    AND (look->>'panels') IN ('Lines','Glass','Solid') AND (look->>'coverSize') IN ('Wide','Portrait','Compact'),false) OR
    (look ? 'large' AND (jsonb_typeof(look->'large')<>'array' OR NOT (look->'large') <@ to_jsonb(fields) OR jsonb_array_length(look->'large')<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(look->'large')))) OR
    jsonb_typeof(look->'hidden') IS DISTINCT FROM 'array' OR NOT (look->'hidden') <@ to_jsonb(fields) OR
    jsonb_array_length(look->'hidden')<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(look->'hidden')) THEN RAISE EXCEPTION 'Invalid page style'; END IF;
  IF jsonb_typeof(draft->'entries') IS DISTINCT FROM 'array' OR jsonb_array_length(draft->'entries')>4 OR
    jsonb_typeof(draft->'trackTitle') IS DISTINCT FROM 'string' OR length(draft->>'trackTitle')>80 THEN RAISE EXCEPTION 'Invalid journal or track'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(draft->'entries') LOOP
    IF NOT item ?& ARRAY['title','note','photo'] OR item-ARRAY['title','note','photo','crew'] <> '{}'::jsonb OR
      (item ? 'crew' AND jsonb_typeof(item->'crew')<>'boolean') OR jsonb_typeof(item->'title')<>'string' OR length(btrim(item->>'title')) NOT BETWEEN 1 AND 80 OR
      jsonb_typeof(item->'note')<>'string' OR length(item->>'note')>450 OR
      (item->'photo'<>'null'::jsonb AND (jsonb_typeof(item->'photo')<>'string' OR length(item->>'photo')>200000 OR
       item->>'photo' !~ '^data:image/jpeg;base64,/9j/[A-Za-z0-9+/]+={0,2}$')) THEN RAISE EXCEPTION 'Invalid journal entry'; END IF;
  END LOOP;
  IF (draft->>'music') ~* '^https://[a-z0-9-]+([.][a-z0-9-]+)+/[^?#[:space:]]*[.](mp3|m4a|aac|wav)([?][^#[:space:]]*)?$'
    AND length(draft->>'music')<=350 AND draft->>'music' !~* '^https://(open[.]spotify[.]com|music[.]apple[.]com)/' THEN
    audio:=draft->>'music'; core:=core||jsonb_build_object('music','');
  END IF;
  core:=core||jsonb_build_object('layout',(draft->'layout')-'journal'-'guestbook');
  PERFORM public.save_member_page(core,expected_revision);
  INSERT INTO public.member_page_designs VALUES(public.current_member_id(),look,draft->'layout',draft->'entries',audio,draft->>'trackTitle')
    ON CONFLICT(member_id) DO UPDATE SET look=excluded.look,ordering=excluded.ordering,entries=excluded.entries,direct_audio=excluded.direct_audio,track_title=excluded.track_title;
END $$;

-- The original endpoint still serves older installed clients, observing the same visibility choices.
ALTER FUNCTION public.read_member_page(uuid) RENAME TO read_member_page_base;
REVOKE ALL ON FUNCTION public.read_member_page_base(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.read_member_page(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.read_member_page_base(target); h jsonb; s jsonb:=p->'settings';
BEGIN
 IF target=public.current_member_id() THEN RETURN p; END IF;
 SELECT look->'hidden' INTO h FROM public.member_page_designs WHERE member_id=target;
 IF h ? 'garage' THEN p:=p||'{"vehicles":[]}'; s:=s||'{"vehicleId":null}'; END IF;
 IF h ? 'friends' THEN p:=p||'{"featuredFriends":[]}';s:=s||'{"topEight":[]}'; END IF;
 IF h ? 'music' THEN s:=s||'{"music":""}'; END IF;
 IF h ? 'about' THEN s:=s||'{"bio":""}'; END IF;
 IF h ? 'work' THEN s:=s||'{"linkedin":"","work":""}'; END IF;
 IF h ? 'drive' THEN s:=s||'{"driveSlug":""}'; END IF;
 RETURN p||jsonb_build_object('settings',s);
END $$;
CREATE FUNCTION public.read_designed_member_page(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE p jsonb:=public.read_member_page(target); d public.member_page_designs%rowtype; s jsonb:=p->'settings'; mine boolean:=target=public.current_member_id();
BEGIN
 SELECT * INTO d FROM public.member_page_designs WHERE member_id=target;
 IF NOT FOUND THEN RETURN p; END IF;
 s:=s||jsonb_build_object('look',d.look,'layout',d.ordering,'entries',CASE WHEN mine OR NOT (d.look->'hidden' ? 'journal') THEN d.entries ELSE '[]'::jsonb END);
 IF mine OR NOT (d.look->'hidden' ? 'music') THEN
   s:=s||jsonb_build_object('music',coalesce(nullif(s->>'music',''),d.direct_audio),'trackTitle',d.track_title);
 END IF;
 RETURN p||jsonb_build_object('settings',s);
END $$;

CREATE FUNCTION public.can_visit_guestbook(target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.can_visit_member_page(target) AND NOT EXISTS(SELECT FROM public.member_page_designs WHERE member_id=target AND look->'hidden' ? 'guestbook')
$$;
CREATE FUNCTION public.member_guest_notes(target uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT coalesce(public.can_visit_guestbook(target),false) THEN RAISE EXCEPTION 'Guestbook unavailable' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(to_jsonb(n)-'created_at' ORDER BY created_at DESC,id DESC),'[]'::jsonb) FROM
  (SELECT g.id,g.author_id AS author,m.display_name AS name,g.body,g.created_at FROM public.member_guestbook g JOIN public.members m ON m.id=g.author_id
    WHERE g.owner_id=target ORDER BY g.created_at DESC,g.id DESC LIMIT 60) n);
END $$;
CREATE FUNCTION public.sign_member_guestbook(target uuid,message text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF target=public.current_member_id() OR NOT coalesce(public.can_visit_guestbook(target),false) THEN RAISE EXCEPTION 'Visiting friends only' USING ERRCODE='42501'; END IF;
 INSERT INTO public.member_guestbook(owner_id,author_id,body) VALUES(target,public.current_member_id(),btrim(message));
END $$;
CREATE FUNCTION public.remove_member_guest_note(target uuid,note_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.member_guestbook WHERE id=note_id AND owner_id=target AND public.current_member_id() IN (owner_id,author_id);
 IF NOT FOUND THEN RAISE EXCEPTION 'Note unavailable' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION public.profile_featured_garage(target uuid,car uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('label',concat_ws(' ',v.year,v.make,v.model,v.trim),'color',v.color,'mods',
   (SELECT coalesce(jsonb_agg(jsonb_build_object('title',m.title,'status',m.status) ORDER BY m.title,m.id),'[]'::jsonb) FROM public.vehicle_mods m WHERE m.vehicle_id=v.id))
 FROM public.vehicles v WHERE v.id=car AND v.owner_member_id=target AND EXISTS(SELECT FROM jsonb_array_elements(public.read_member_page(target)->'vehicles') item WHERE item->>'id'=v.id::text)
$$;
REVOKE ALL ON FUNCTION public.read_member_page(uuid),public.publish_member_profile(jsonb,integer),public.read_designed_member_page(uuid),public.can_visit_guestbook(uuid),public.member_guest_notes(uuid),public.sign_member_guestbook(uuid,text),public.remove_member_guest_note(uuid,uuid),public.profile_featured_garage(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_member_page(uuid),public.publish_member_profile(jsonb,integer),public.read_designed_member_page(uuid),public.member_guest_notes(uuid),public.sign_member_guestbook(uuid,text),public.remove_member_guest_note(uuid,uuid),public.profile_featured_garage(uuid,uuid) TO authenticated;
