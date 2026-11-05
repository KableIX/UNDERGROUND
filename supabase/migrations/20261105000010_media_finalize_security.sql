-- Garage media finalized only by the authenticated API after object existence checks.
-- Direct client INSERT/UPDATE previously allowed forged photographic metadata.
DROP POLICY IF EXISTS vehicle_media_owner_write ON public.vehicle_media;
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_media_storage_path_unique
  ON public.vehicle_media (storage_path);

COMMENT ON TABLE public.vehicle_media IS
  'Client reads follow garage visibility; metadata mutations require server-authorized signed upload completion';
