# UNDERGROUND — Backend activation and release gates

**Status:** Implemented and tested locally; not connected to a live Supabase project. Keep public registration and production territory capture disabled.

## Required backend environment (server ONLY)

- `SUPABASE_URL`: full HTTPS project API origin.
- `SUPABASE_ANON_KEY`: Supabase publishable/anon key used by server to validate user sessions.
- `SUPABASE_SERVICE_ROLE_KEY`: privileged database/storage key, SERVER ONLY. Never export as an `EXPO_PUBLIC_*` variable.
- `APP_ENV`: development/staging/production.
- `API_HOST` and `API_PORT`: bind behind authenticated HTTPS reverse proxy before public deployment.

Do not paste keys into chat, logs, client bundles, or GitHub. Store them in the server deployment's secret manager.

## Implemented member routes

1. `GET /v1/me` — requires `Authorization: Bearer <Supabase Auth access JWT>`. Resolves user on Supabase Auth, then binds to the approved `public.members.auth_user_id`. Returns own profile, vehicle specs, and short-lived (5 minute) private original media read URLs for OWN garage. Friends will eventually receive sanitized derivatives, never private originals.

2. `POST /v1/garage/media/upload-intent` — bearer + member binding + own-vehicle lookup. Body:
   `{ "memberId": "...", "vehicleId": "...", "contentType": "image/jpeg", "caption": "R8", "sortOrder": 0, "localUri": "file:///..." }`.
   The server ignores the client filename and issues a random path under `garage/<auth.uid()>/<vehicle_id>/<uuid>.jpg` and a 2-hour Supabase signed upload URL. Client must upload bytes through the signed URL. No metadata is recorded yet.

3. `POST /v1/garage/media/complete` — bearer + member/vehicle/path ownership + object-existence check; upserts the metadata row in `public.vehicle_media`.
   Body: `{ "memberId": "...", "vehicleId": "...", "storagePath": "...", "caption": "...", "sortOrder": 0 }`. The storage path MUST be exactly in the authenticated user's vehicle namespace.

All other mutation endpoints currently return `503 authenticated_mutations_not_configured` except locally loopback-scoped development simulation. Do not expose these as completed production features.

## Database

Migrations 00001–00010 have been applied to a disposable PostGIS 16 database using an emulated Supabase `auth` and `storage` namespace. The authorization test `tests/supabase-authz-postgres.sql` passed for self-verification, friendship acceptance, forged social counts, and client-written media metadata.

**This does NOT prove live Supabase compatibility.** Apply migrations in a disposable genuine Supabase instance and test storage policies + auth roles before writing production data. Storage originals stay private and EXIF-bearing photos are never exposed in member news feeds.

## Device/mobile integration remaining

- Configure Supabase project, Auth sign-in and member-invitation provisioning.
- Connect the production-candidate login UI to Supabase Auth and exchange access JWTs with this API.
- Implement the iOS signed binary upload and completion call; confirm media survives app restart.
- Use an approved image sanitation service for public gallery/Newswire derivatives.
- Introduce durable PostgreSQL-backed social and route-plan handlers, not `MemoryStore`.
- Implement rate limits, audit logs, request size and abuse controls; refine API failure codes.
- Protect public networking with HTTPS and service ingress policy.
- Mapbox `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` + private native `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` must be configured in EAS development for live MapView.
- Verify native app on physical iPhone and run authorized real-world route tests.
- Implement verified GPS/odometer/finish-photo adjudication and private evidence retention before production territory transfers.

No App Store or public membership release until these gates pass.
