-- Clubs, invitations, memberships, follows, local opt-in directory.
-- Club territory scoring reuses ownership_track = 'club' (independent of solo).

CREATE TYPE public.club_role AS ENUM ('owner', 'officer', 'member');
CREATE TYPE public.club_invitation_status AS ENUM ('pending', 'accepted', 'rejected', 'revoked');
CREATE TYPE public.founding_market AS ENUM ('california', 'miami');

CREATE TABLE public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  founding_market public.founding_market NOT NULL,
  created_by_member_id UUID NOT NULL REFERENCES public.members (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  role public.club_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (club_id, member_id)
);

CREATE TABLE public.club_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES public.members (id),
  invitee_id UUID NOT NULL REFERENCES public.members (id),
  status public.club_invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT club_invitations_not_self CHECK (inviter_id <> invitee_id)
);

CREATE TABLE public.follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follows_not_self CHECK (follower_id <> followee_id),
  UNIQUE (follower_id, followee_id)
);

CREATE TABLE public.directory_opt_ins (
  member_id UUID PRIMARY KEY REFERENCES public.members (id) ON DELETE CASCADE,
  opted_in BOOLEAN NOT NULL DEFAULT FALSE,
  market public.founding_market NOT NULL,
  visible_display_name TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_opt_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY clubs_select_auth ON public.clubs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY club_memberships_select_auth ON public.club_memberships
  FOR SELECT TO authenticated USING (true);

CREATE POLICY club_invitations_select_participants ON public.club_invitations
  FOR SELECT USING (
    inviter_id = public.current_member_id()
    OR invitee_id = public.current_member_id()
  );

CREATE POLICY follows_select_auth ON public.follows
  FOR SELECT TO authenticated USING (true);

CREATE POLICY follows_insert_self ON public.follows
  FOR INSERT WITH CHECK (follower_id = public.current_member_id());

CREATE POLICY follows_delete_self ON public.follows
  FOR DELETE USING (follower_id = public.current_member_id());

-- Directory: only opted-in rows are readable by authenticated members.
CREATE POLICY directory_select_opted_in ON public.directory_opt_ins
  FOR SELECT TO authenticated USING (opted_in = TRUE);

CREATE POLICY directory_upsert_self ON public.directory_opt_ins
  FOR ALL USING (member_id = public.current_member_id())
  WITH CHECK (member_id = public.current_member_id());

COMMENT ON TABLE public.clubs IS 'Club entities; territory scoring uses ownership_track=club independently of solo';
COMMENT ON TABLE public.directory_opt_ins IS 'Local opt-in member directory for founding markets california/miami';
