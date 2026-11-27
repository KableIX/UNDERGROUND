CREATE FUNCTION public.request_member_friendship(member_number_input text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := public.current_member_id(); recipient uuid; existing public.friendships%ROWTYPE;
BEGIN
  IF actor IS NULL OR member_number_input !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'Enter a six-digit member number.'; END IF;
  SELECT id INTO recipient FROM public.members WHERE member_number=member_number_input;
  IF recipient IS NULL THEN RAISE EXCEPTION 'Member unavailable.'; END IF;
  IF actor=recipient THEN RAISE EXCEPTION 'Enter another member number.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(least(actor,recipient)::text||greatest(actor,recipient)::text,0));
  SELECT * INTO existing FROM public.friendships WHERE (requester_id,addressee_id) IN ((actor,recipient),(recipient,actor))
  ORDER BY (status='accepted') DESC,(status='pending') DESC LIMIT 1;
  IF FOUND THEN
    IF existing.status='accepted' THEN RETURN 'Already friends.'; END IF;
    IF existing.status='pending' AND existing.requester_id=recipient THEN RETURN 'You already have an incoming request from this member.'; END IF;
    IF existing.status='pending' THEN RETURN 'Request pending.'; END IF;
    RETURN 'Request unavailable.';
  END IF;
  INSERT INTO public.friendships(requester_id,addressee_id) VALUES(actor,recipient);
  RETURN 'Request sent.';
END $$;
REVOKE ALL ON FUNCTION public.request_member_friendship(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_member_friendship(text) TO authenticated;
