-- CLOUT ledger + Newswire stories + run event idempotency stubs.
-- Append-only semantics: no UPDATE policies for ledger tables.

CREATE TYPE public.clout_reason AS ENUM (
  'verified_capture_accepted',
  'territory_defense',
  'district_crown'
);

CREATE TABLE public.clout_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members (id),
  run_id UUID REFERENCES public.runs (id),
  territory_definition_id UUID REFERENCES public.territory_definitions (id),
  delta INTEGER NOT NULL,
  reason public.clout_reason NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.newswire_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.members (id),
  run_id UUID NOT NULL REFERENCES public.runs (id),
  territory_slug TEXT NOT NULL,
  territory_name TEXT NOT NULL,
  template_id TEXT NOT NULL CHECK (template_id = 'capture_accepted_v1'),
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  clout_delta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.runs (id),
  from_state public.run_pipeline_state NOT NULL,
  to_state public.run_pipeline_state NOT NULL,
  evidence_source public.evidence_source NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clout_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newswire_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.run_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY clout_ledger_select_own ON public.clout_ledger
  FOR SELECT USING (member_id = public.current_member_id());

CREATE POLICY newswire_stories_select_auth ON public.newswire_stories
  FOR SELECT TO authenticated USING (true);

CREATE POLICY run_events_select_own ON public.run_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_id AND r.member_id = public.current_member_id()
    )
  );

COMMENT ON TABLE public.clout_ledger IS 'Append-only CLOUT ledger; writes via service role API only';
COMMENT ON TABLE public.ownership_ledger IS 'Append-only ownership ledger; never UPDATE/DELETE in app code';
