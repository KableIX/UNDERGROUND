# Finish photos stay on the phone

Decided by TJ on 2026-11-27.

## Flow

1. After a GPS-completed Run, the member takes a car and/or dash photo within 30 minutes
   (`FINISH_PHOTO_WINDOW_MS`). Camera photos use the phone's GPS fix at capture; library picks use EXIF.
2. The app re-encodes the image (drops EXIF/GPS) and keeps the only copy in the app's documents
   folder (`finish-photos/`). It appears in **Profile → My Run Photos** (`/trips/run-photos`).
   The image is **never uploaded**. There is no finish-photo upload endpoint.
3. When the photo set is final (both photos taken, or the window closed), the app sends
   `POST /v1/run-attempts` with a **non-image proof** per photo: kind, capture time, GPS fix
   (lat/lng/accuracy), source, and the SHA-256 of the stripped image file.
   The strict schema rejects image bytes and storage paths.
4. The API checks the fix and time against the route finish **in memory**
   (250 m radius, 30-minute window) and drops the location (`dropPhotoLocation`). It stores only the
   credit result in `route_run_credits`: tier, points, `verified`, per-photo status, capture times,
   and the image hash. The first accepted credit is final (`ignoreDuplicates`).
5. The app then deletes the capture location from its local `finish_photos` rows and keeps the
   credit result. Photos added after that are kept without location and do not change the credit.

## Server schema

`20261127000003_route_top_three_and_photo_privacy.sql` drops `car_lat`, `car_lng`, `dash_lat`,
`dash_lng`, `car_photo_path` and `dash_photo_path` from `route_run_credits` and adds
`verified`, `car_image_sha256` and `dash_image_sha256`. Unique indexes on the hashes stop one photo
crediting two runs; a check stops one photo counting as both car and dash.

The `evidence-originals` bucket is no longer used for runs. Any `runs/` objects from testing should
be removed with the Storage API by an operator.

## Anti-cheat

Finish nonce, in-app camera only, and App Attest behind a flag: see `finish-photo-anti-cheat.md`.

## Anti-cheat trade-offs

Without the image, the server cannot look at the photo. Verification rests on the phone's reported
GPS fix and capture time, plus the server-validated GPS trace of the run itself
(`route_run_finishes`, which every credit must reference). See the branch report for details.

## Other places that send user photos to servers

Not changed by this decision:

- **Garage photos** (`apps/mobile/src/lib/garage-photo-transfer.ts`): uploaded to the private
  `garage-originals` bucket through `/v1/garage/media/upload-intent`.
- **Spotted** (`apps/mobile/src/spotted/photo.ts`): a downsized JPEG is sent to `/v1/spotted/identify`,
  which forwards it to the configured vision model (`SPOTTED_VISION_URL`) to identify the car.
- **Spotted owner requests** (`apps/mobile/src/spotted/OwnerConfirmation.tsx`): a base64 thumbnail
  is stored in `spotted_confirmations.thumbnail`.
- **Profile page images** (`apps/mobile/src/profile/store.ts`, `pickPhoto`): cover, avatar, journal
  and featured images are embedded as JPEG data URLs in the published page
  (`publish_custom_member_page`).
- **SupercarGO branch**: uploads sightings to a private bucket (separate branch, not touched).
