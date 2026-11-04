-- Core schema stubs for UNDERGROUND.
-- Founder ≠ admin: is_founder and role are independent columns.

CREATE TYPE public.member_role AS ENUM ('member', 'admin');
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'rejected', 'removed');
CREATE TYPE public.verification_status AS ENUM ('unverified', 'pending_review', 'verified', 'rejected');
CREATE TYPE public.mod_status AS ENUM ('installed', 'pending');
CREATE TYPE public.garage_visibility AS ENUM ('private', 'friends', 'public');
CREATE TYPE public.territory_status AS ENUM ('draft', 'approved', 'retired');
CREATE TYPE public.ownership_track AS ENUM ('solo', 'club');
CREATE TYPE public.ownership_reason AS ENUM ('capture', 'challenge', 'defense', 'takeover', 'neutralize');
CREATE TYPE public.run_pipeline_state AS ENUM (
  'CREATED',
  'START_VERIFIED',
  'RECORDING',
  'ROUTE_COMPLETE',
  'FINISH_PENDING',
  'EVIDENCE_REVIEW',
  'ACCEPTED',
  'REJECTED'
);
CREATE TYPE public.evidence_source AS ENUM ('production', 'simulation');

CREATE TABLE public.members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  member_number CHAR(6) NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_founder BOOLEAN NOT NULL DEFAULT FALSE,
  role public.member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT members_number_format CHECK (member_number ~ '^\d{6}$')
);

CREATE TABLE public.profiles (
  member_id UUID PRIMARY KEY REFERENCES public.members (id) ON DELETE CASCADE,
  bio TEXT,
  cover_asset_id UUID,
  avatar_asset_id UUID,
  friend_count INTEGER NOT NULL DEFAULT 0 CHECK (friend_count >= 0),
  follower_count INTEGER NOT NULL DEFAULT 0 CHECK (follower_count >= 0),
  top_eight UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_top_eight_len CHECK (cardinality(top_eight) <= 8)
);

CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  status public.friendship_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_pair UNIQUE (requester_id, addressee_id)
);

CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_member_id UUID NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  color TEXT NOT NULL,
  transmission TEXT,
  wheels TEXT,
  brakes TEXT,
  verification_status public.verification_status NOT NULL DEFAULT 'unverified',
  visibility public.garage_visibility NOT NULL DEFAULT 'friends',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_mods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.mod_status NOT NULL,
  installed_at TIMESTAMPTZ
);

CREATE TABLE public.vehicle_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  is_placeholder BOOLEAN NOT NULL DEFAULT TRUE,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.districts (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  region TEXT NOT NULL
);

CREATE TABLE public.territory_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  district_slug TEXT NOT NULL REFERENCES public.districts (slug),
  version INTEGER NOT NULL CHECK (version > 0),
  status public.territory_status NOT NULL DEFAULT 'draft',
  eligible_weight NUMERIC NOT NULL CHECK (eligible_weight > 0),
  geometry geography(LineString, 4326) NOT NULL,
  geometry_label TEXT NOT NULL DEFAULT 'DRAFT_PLACEHOLDER_LINESTRING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE public.ownership_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_definition_id UUID NOT NULL REFERENCES public.territory_definitions (id),
  track public.ownership_track NOT NULL,
  owner_id UUID REFERENCES public.members (id),
  previous_owner_id UUID REFERENCES public.members (id),
  points NUMERIC NOT NULL DEFAULT 0 CHECK (points >= 0),
  reason public.ownership_reason NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ownership_current (
  territory_definition_id UUID NOT NULL REFERENCES public.territory_definitions (id),
  track public.ownership_track NOT NULL,
  owner_id UUID REFERENCES public.members (id),
  points NUMERIC NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (territory_definition_id, track)
);

CREATE TABLE public.runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members (id),
  territory_definition_id UUID NOT NULL REFERENCES public.territory_definitions (id),
  state public.run_pipeline_state NOT NULL DEFAULT 'CREATED',
  evidence_source public.evidence_source NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hard-gate: simulation evidence rows must never be used to mutate ownership_current
-- in production. Enforced in API/engine; DB comment for operators.
COMMENT ON COLUMN public.runs.evidence_source IS
  'simulation evidence is test-only; must not write production ownership_current';
