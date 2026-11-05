-- Needed for idempotent authenticated garage upload completion.
-- One storage object must never be registered multiple times or under multiple vehicles.
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_media_storage_path_unique
  ON public.vehicle_media (storage_path);
