-- Private storage bucket contracts for garage + evidence originals.
-- Apply via Supabase dashboard/CLI when credentials exist.
-- No public read on originals; sanitized derivatives are a later phase.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'garage-originals',
    'garage-originals',
    false,
    20971520,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'evidence-originals',
    'evidence-originals',
    false,
    20971520,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- Members may upload only under their own garage prefix.
CREATE POLICY garage_originals_insert_own
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'garage-originals'
  AND (storage.foldername(name))[1] = 'garage'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY garage_originals_select_own
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'garage-originals'
  AND (storage.foldername(name))[1] = 'garage'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Evidence originals: service role / API only (no direct client policies).
-- Client evidence uploads go through signed URLs minted by services/api.
