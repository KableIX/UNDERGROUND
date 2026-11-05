-- Persistent schema expansion: invites, notifications, comments, DMs,
-- guestbooks, clubhouses/events, verification reviews, GPS tracks,
-- checkpoints, garage credits, sightings, route plans.
-- No cloud Supabase assumed — apply locally with PostGIS (see docker-compose).

CREATE TYPE public.member_invitation_status AS ENUM (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

CREATE TYPE public.notification_kind AS ENUM (
  'friend_request',
  'friend_accepted',
  'club_invite',
  'capture_accepted',
  'capture_rejected',
  'crown_awarded',
  'dm_received',
  'guestbook_entry',
  'system'
);

CREATE TYPE public.verification_review_decision AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE public.garage_credit_reason AS ENUM (
  'verified_capture',
  'sighting_confirmed',
  'founder_grant',
  'inventory_spend',
  'dupe_reversed'
);

CREATE TYPE public.sighting_status AS ENUM (
  'pending',
  'confirmed',
  'rejected',
  'duplicate'
);

CREATE TYPE public.route_class AS ENUM ('scenic', 'technical');

CREATE TYPE public.route_plan_status AS ENUM (
  'draft',
  'shared',
  'archived'
);

CREATE TYPE public.dm_thread_kind AS ENUM ('direct', 'club', 'event');

-- Invitation-only membership gate
CREATE TABLE public.member_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  invited_by_member_id UUID REFERENCES public.members (id),
  invitee_email_hash TEXT,
  status public.member_invitation_status NOT NULL DEFAULT 'pending',
  accepted_member_id UUID REFERENCES public.members (id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.newswire_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.newswire_stories (id) ON DELETE CASCADE,
  author_member_id UUID NOT NULL REFERENCES public.members (id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dm_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.dm_thread_kind NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dm_thread_participants (
  thread_id UUID NOT NULL REFERENCES public.dm_threads (id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, member_id)
);

CREATE TABLE public.dm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.dm_threads (id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.members (id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.guestbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  author_member_id UUID NOT NULL REFERENCES public.members (id),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT guestbook_not_self CHECK (profile_member_id <> author_member_id)
);

CREATE TABLE public.clubhouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL UNIQUE REFERENCES public.clubs (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.club_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs (id) ON DELETE CASCADE,
  created_by_member_id UUID NOT NULL REFERENCES public.members (id),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_verification_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  submitted_by_member_id UUID NOT NULL REFERENCES public.members (id),
  decision public.verification_review_decision NOT NULL DEFAULT 'pending',
  reviewer_member_id UUID REFERENCES public.members (id),
  notes TEXT,
  evidence_paths TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE public.run_gps_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.runs (id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 0),
  recorded_at TIMESTAMPTZ NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  accuracy_m NUMERIC,
  UNIQUE (run_id, seq)
);

CREATE TABLE public.run_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.runs (id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  reached_at TIMESTAMPTZ NOT NULL,
  geom geography(Point, 4326) NOT NULL,
  within_corridor BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.garage_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members (id),
  delta INTEGER NOT NULL,
  reason public.garage_credit_reason NOT NULL,
  inventory_sku TEXT,
  run_id UUID REFERENCES public.runs (id),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sightings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_member_id UUID NOT NULL REFERENCES public.members (id),
  subject_vehicle_id UUID NOT NULL REFERENCES public.vehicles (id),
  status public.sighting_status NOT NULL DEFAULT 'pending',
  photo_storage_path TEXT,
  dedupe_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dedupe_key)
);

CREATE TABLE public.route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_member_id UUID NOT NULL REFERENCES public.members (id),
  title TEXT NOT NULL,
  route_class public.route_class NOT NULL,
  status public.route_plan_status NOT NULL DEFAULT 'draft',
  distance_m NUMERIC CHECK (distance_m IS NULL OR distance_m >= 0),
  -- Road-following contract: geometry must come from a provider or operator
  -- review; clients must not invent roads. DRAFT until reviewed.
  geometry geography(LineString, 4326),
  geometry_source TEXT NOT NULL DEFAULT 'unreviewed_draft',
  road_following_contract TEXT NOT NULL DEFAULT 'provider_or_operator_required',
  gpx_sha256 TEXT,
  share_visibility public.garage_visibility NOT NULL DEFAULT 'private',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.route_plan_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id UUID NOT NULL REFERENCES public.route_plans (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('start', 'checkpoint', 'finish', 'stage_break')),
  seq INTEGER NOT NULL CHECK (seq >= 0),
  label TEXT,
  geom geography(Point, 4326) NOT NULL,
  UNIQUE (route_plan_id, seq)
);

CREATE TABLE public.route_plan_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id UUID NOT NULL REFERENCES public.route_plans (id) ON DELETE CASCADE,
  stage_index INTEGER NOT NULL CHECK (stage_index >= 0),
  title TEXT NOT NULL,
  UNIQUE (route_plan_id, stage_index)
);

CREATE TABLE public.garage_visit_stats (
  vehicle_id UUID PRIMARY KEY REFERENCES public.vehicles (id) ON DELETE CASCADE,
  view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  unique_visitor_approx BIGINT NOT NULL DEFAULT 0 CHECK (unique_visitor_approx >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.preview_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  granted_by_member_id UUID NOT NULL REFERENCES public.members (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, vehicle_id)
);

-- RLS
ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newswire_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_thread_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubhouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_verification_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_gps_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sightings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plan_waypoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_plan_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_visit_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preview_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT USING (member_id = public.current_member_id());

CREATE POLICY newswire_comments_select_auth ON public.newswire_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY newswire_comments_insert_self ON public.newswire_comments
  FOR INSERT WITH CHECK (author_member_id = public.current_member_id());

CREATE POLICY dm_participants_select_self ON public.dm_thread_participants
  FOR SELECT USING (member_id = public.current_member_id());

CREATE POLICY dm_messages_select_participant ON public.dm_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.dm_thread_participants p
      WHERE p.thread_id = dm_messages.thread_id
        AND p.member_id = public.current_member_id()
    )
  );

CREATE POLICY dm_messages_insert_sender ON public.dm_messages
  FOR INSERT WITH CHECK (
    sender_id = public.current_member_id()
    AND EXISTS (
      SELECT 1 FROM public.dm_thread_participants p
      WHERE p.thread_id = dm_messages.thread_id
        AND p.member_id = public.current_member_id()
    )
  );

CREATE POLICY guestbook_select_auth ON public.guestbook_entries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY guestbook_insert_author ON public.guestbook_entries
  FOR INSERT WITH CHECK (
    author_member_id = public.current_member_id()
    AND public.are_friends(profile_member_id, public.current_member_id())
  );

CREATE POLICY clubhouses_select_auth ON public.clubhouses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY club_events_select_auth ON public.club_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY verification_reviews_select_owner ON public.vehicle_verification_reviews
  FOR SELECT USING (
    submitted_by_member_id = public.current_member_id()
    OR EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.owner_member_id = public.current_member_id()
    )
  );

CREATE POLICY run_gps_select_own ON public.run_gps_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_id AND r.member_id = public.current_member_id()
    )
  );

CREATE POLICY run_checkpoints_select_own ON public.run_checkpoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_id AND r.member_id = public.current_member_id()
    )
  );

CREATE POLICY garage_credit_select_own ON public.garage_credit_ledger
  FOR SELECT USING (member_id = public.current_member_id());

CREATE POLICY sightings_select_auth ON public.sightings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY sightings_insert_reporter ON public.sightings
  FOR INSERT WITH CHECK (reporter_member_id = public.current_member_id());

CREATE POLICY route_plans_select_visible ON public.route_plans
  FOR SELECT USING (
    owner_member_id = public.current_member_id()
    OR share_visibility = 'public'
    OR (
      share_visibility = 'friends'
      AND public.are_friends(owner_member_id, public.current_member_id())
    )
  );

CREATE POLICY route_plans_owner_write ON public.route_plans
  FOR ALL USING (owner_member_id = public.current_member_id())
  WITH CHECK (owner_member_id = public.current_member_id());

CREATE POLICY preview_entitlements_select_parties ON public.preview_entitlements
  FOR SELECT USING (
    member_id = public.current_member_id()
    OR granted_by_member_id = public.current_member_id()
  );

CREATE POLICY garage_visit_stats_select_auth ON public.garage_visit_stats
  FOR SELECT TO authenticated USING (true);

-- Club invite write policies (service role still owns gameplay mutations)
CREATE POLICY club_invitations_insert_officer ON public.club_invitations
  FOR INSERT WITH CHECK (
    inviter_id = public.current_member_id()
    AND EXISTS (
      SELECT 1 FROM public.club_memberships m
      WHERE m.club_id = club_invitations.club_id
        AND m.member_id = public.current_member_id()
        AND m.role IN ('owner', 'officer')
    )
  );

CREATE POLICY vehicle_mods_owner_write ON public.vehicle_mods
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.owner_member_id = public.current_member_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.owner_member_id = public.current_member_id()
    )
  );

CREATE POLICY vehicle_media_owner_write ON public.vehicle_media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.owner_member_id = public.current_member_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_id AND v.owner_member_id = public.current_member_id()
    )
  );

COMMENT ON TABLE public.member_invitations IS 'Invitation-only gate; store code hashes only — never plaintext invite codes in logs';
COMMENT ON TABLE public.garage_credit_ledger IS 'Soft inventory credits only — no real-money value';
COMMENT ON TABLE public.route_plans IS 'Road-following contract: no fabricated roads; DRAFT until provider/operator geometry';
COMMENT ON COLUMN public.sightings.dedupe_key IS 'Fraud/dupe prevention key (reporter+vehicle+time bucket)';
