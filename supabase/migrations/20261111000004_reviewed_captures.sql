BEGIN;
-- A surveyed conquest is enabled individually after its gates and evidence workflow are approved.
ALTER TABLE public.territory_definitions ADD COLUMN capture_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.runs ADD COLUMN representing_club_id uuid REFERENCES public.clubs(id);
CREATE TABLE public.club_capture_ledger (
  run_id uuid PRIMARY KEY REFERENCES public.runs(id),
  territory_definition_id uuid NOT NULL REFERENCES public.territory_definitions(id),
  club_id uuid NOT NULL REFERENCES public.clubs(id), points numeric NOT NULL CHECK(points>0)
);
ALTER TABLE public.club_capture_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY club_score_read ON public.club_capture_ledger FOR SELECT TO authenticated USING(public.current_member_id() IS NOT NULL);
CREATE VIEW public.club_conquest_standings WITH (security_invoker=true) AS
 SELECT territory_definition_id,club_id,sum(points) AS points,
 dense_rank() OVER(PARTITION BY territory_definition_id ORDER BY sum(points) DESC) AS place
 FROM public.club_capture_ledger GROUP BY territory_definition_id,club_id;
GRANT SELECT ON public.club_capture_ledger TO authenticated;
GRANT SELECT ON public.club_conquest_standings TO authenticated;
CREATE FUNCTION public.accept_reviewed_run(target uuid) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE
  r public.runs%ROWTYPE;
  t public.territory_definitions%ROWTYPE;
  e public.run_evidence_bundles%ROWTYPE;
  old public.ownership_current%ROWTYPE;
  winner uuid;
  score numeric;
  why public.ownership_reason;
  member_name text;
BEGIN
  SELECT * INTO STRICT r FROM public.runs WHERE id=target FOR UPDATE;
  IF r.state='ACCEPTED' AND EXISTS(SELECT FROM public.clout_ledger WHERE idempotency_key='clout:'||target||':verified_capture_accepted') THEN RETURN; END IF;
  IF r.state<>'EVIDENCE_REVIEW' OR r.evidence_source<>'production' THEN RAISE EXCEPTION 'Run is ineligible for review'; END IF;
  SELECT * INTO STRICT t FROM public.territory_definitions WHERE id=r.territory_definition_id FOR UPDATE;
  IF NOT t.capture_enabled OR t.status<>'approved' OR NOT EXISTS(SELECT FROM public.districts WHERE slug=t.district_slug AND kind='production_candidate') THEN RAISE EXCEPTION 'Capture disabled'; END IF;
  SELECT * INTO STRICT e FROM public.run_evidence_bundles WHERE run_id=target FOR UPDATE;
  IF e.source<>'production' OR e.is_placeholder OR NOT e.within_finish_zone OR
    least(length(trim(e.start_odometer_path)),length(trim(e.end_odometer_path)),length(trim(e.finish_photo_path)))=0 OR
    e.start_odometer_miles IS NULL OR e.end_odometer_miles IS NULL OR e.end_odometer_miles<e.start_odometer_miles OR
    least(e.end_captured_at,e.finish_captured_at)<=e.start_captured_at THEN RAISE EXCEPTION 'Incomplete evidence'; END IF;
  SELECT * INTO old FROM public.ownership_current WHERE territory_definition_id=t.id AND track='solo';
  winner:=r.member_id; score:=t.eligible_weight;
  IF old.owner_id IS NULL THEN why:='capture';
  ELSIF old.owner_id=r.member_id THEN why:='defense'; score:=old.points+score;
  ELSIF score>old.points THEN why:='takeover';
  ELSE why:='challenge'; winner:=old.owner_id; score:=old.points;
  END IF;
  INSERT INTO public.ownership_ledger(territory_definition_id,track,owner_id,previous_owner_id,points,reason,idempotency_key)
    VALUES(t.id,'solo',winner,old.owner_id,score,why,'ownership:'||target);
  INSERT INTO public.ownership_current(territory_definition_id,track,owner_id,points) VALUES(t.id,'solo',winner,score)
    ON CONFLICT(territory_definition_id,track) DO UPDATE SET owner_id=excluded.owner_id,points=excluded.points,updated_at=now();
  IF r.representing_club_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT FROM public.club_memberships WHERE club_id=r.representing_club_id AND member_id=r.member_id AND joined_at<=r.created_at) THEN RAISE EXCEPTION 'Club membership not confirmed'; END IF;
    INSERT INTO public.club_capture_ledger(run_id,territory_definition_id,club_id,points)
      VALUES(target,t.id,r.representing_club_id,t.eligible_weight);
  END IF;
  INSERT INTO public.clout_ledger(member_id,run_id,territory_definition_id,delta,reason,idempotency_key)
    VALUES(r.member_id,target,t.id,25,'verified_capture_accepted','clout:'||target||':verified_capture_accepted');
  SELECT display_name INTO STRICT member_name FROM public.members WHERE id=r.member_id;
  INSERT INTO public.newswire_stories(member_id,run_id,territory_slug,territory_name,template_id,headline,body,clout_delta)
    VALUES(r.member_id,target,t.slug,t.name,'capture_accepted_v1',member_name||' completed '||t.name,
      CASE why WHEN 'takeover' THEN 'Solo control changed hands.' WHEN 'capture' THEN 'Solo control claimed.' WHEN 'defense' THEN 'Solo control defended.' ELSE 'The current holder retained control.' END,25);
  INSERT INTO public.run_events(run_id,from_state,to_state,evidence_source,idempotency_key,occurred_at)
    VALUES(target,'EVIDENCE_REVIEW','ACCEPTED','production','review:'||target,now());
  UPDATE public.runs SET state='ACCEPTED',updated_at=now() WHERE id=target;
END $$;
REVOKE ALL ON FUNCTION public.accept_reviewed_run(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_reviewed_run(uuid) TO service_role;

CREATE FUNCTION public.member_standings() RETURNS TABLE("memberId" uuid,"displayName" text,"memberNumber" text,"cloutTotal" integer,"territoriesHeld" integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.id,m.display_name,trim(m.member_number),coalesce(c.total,0)::integer,coalesce(o.held,0)::integer
 FROM public.members m
 LEFT JOIN (SELECT member_id,sum(delta) total FROM public.clout_ledger GROUP BY member_id) c ON c.member_id=m.id
 LEFT JOIN (SELECT owner_id,count(*) held FROM public.ownership_current WHERE track='solo' GROUP BY owner_id) o ON o.owner_id=m.id
 WHERE public.current_member_id() IS NOT NULL AND (c.member_id IS NOT NULL OR o.held>0)
 ORDER BY coalesce(c.total,0) DESC,coalesce(o.held,0) DESC,m.member_number
$$;
REVOKE ALL ON FUNCTION public.member_standings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.member_standings() TO authenticated;
COMMIT;
