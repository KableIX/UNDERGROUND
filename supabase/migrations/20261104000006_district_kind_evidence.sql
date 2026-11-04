-- District kind (development vs production_candidate) + evidence bundle stubs.

CREATE TYPE public.district_kind AS ENUM ('production_candidate', 'development');

ALTER TABLE public.districts
  ADD COLUMN IF NOT EXISTS kind public.district_kind NOT NULL DEFAULT 'production_candidate';

UPDATE public.districts
SET kind = 'development'
WHERE slug = 'silicon-valley-dev';

UPDATE public.districts
SET kind = 'production_candidate'
WHERE slug = 'monterey';

CREATE TABLE public.run_evidence_bundles (
  run_id UUID PRIMARY KEY REFERENCES public.runs (id) ON DELETE CASCADE,
  source public.evidence_source NOT NULL,
  start_odometer_path TEXT NOT NULL,
  start_odometer_miles NUMERIC,
  start_captured_at TIMESTAMPTZ NOT NULL,
  end_odometer_path TEXT NOT NULL,
  end_odometer_miles NUMERIC,
  end_captured_at TIMESTAMPTZ NOT NULL,
  finish_photo_path TEXT NOT NULL,
  finish_captured_at TIMESTAMPTZ NOT NULL,
  within_finish_zone BOOLEAN NOT NULL,
  is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.run_evidence_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY run_evidence_select_own ON public.run_evidence_bundles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_id AND r.member_id = public.current_member_id()
    )
  );

COMMENT ON COLUMN public.districts.kind IS
  'development districts never accept production ownership writes';
