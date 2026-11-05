# UNDERGROUND — Live member and garage activation

**Implementation:** `feature/garage-persistence-api`
**Status:** Code and unit tests complete; live Supabase/App backend/device integration not yet verified.

## Backend prerequisites

Provision one isolated **development** Supabase project and apply migrations in lexical order,
including `20261105000010_garage_media_uniqueness.sql`.

Keep the following **server-side only**, in the API deployment's secure environment:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must never be bundled into Expo or committed to Git.

Configure a reachable HTTPS API host for `services/api`, with restricted CORS/firewall and
real member JWT validation, then bind a Supabase Auth user to an approved `public.members`
record. The Founder record must be provisioned via the audited workflow; do not treat the
`STARK` username as privileged.

## Expo environment (development)

Set these public configuration values in EAS or a local ignored `.env.local` file:

- `EXPO_PUBLIC_SUPABASE_URL` — public Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — public anon/publishable key
- `EXPO_PUBLIC_API_URL` — deployed HTTPS API base URL

Do not set these until the services are correctly provisioned. With values missing, the
app continues to use **clearly labeled development fixtures**; no fake authenticated user
is created in release builds.

A new signed EAS development client is needed for `expo-secure-store`,
`expo-image-manipulator`, `expo-file-system`, and `expo-image-picker`. Existing
installed iOS binaries may not include those native modules.

## Implemented mobile workflow

1. Email/password sign-in through Supabase Auth (no fake name-only production login).
2. Backend `GET /v1/me` validates the actual JWT and approved member binding.
3. Supabase session is persisted in iOS SecureStore, chunked below Keychain item-size thresholds.
4. Garage data is fetched from `/v1/me`; the production view does not use the Founder fixture.
5. Photo picker selects an actual image and converts it to JPEG.
6. Client requests a signed, owner-scoped upload plan from `POST /v1/garage/media/upload-intent`.
7. Client uploads to the private `garage-originals` bucket using the scoped token.
8. Client finalizes metadata via `POST /v1/garage/media/complete`; server checks ownership
   and object existence.
9. Private owner media uses short-lived signed read URLs returned by `GET /v1/me`.
10. Logout invalidates the local secure session.

## Not yet complete / release blockers

- End-to-end tests against a **live** Supabase Auth and Storage project, including uploading
  HEIC/JPEG files on an actual registered iPhone.
- Full invitation redemption and email verification workflow (production fixture code is blocked).
- Member onboarding, founder provisioning, approved vehicle registration and edit endpoints.
- Live profile mutation, public sanitized photo derivatives, friend-gated garage reads.
- Real approved route geometry, GPS/camera verification, and server-authoritative ownership writes.
- Native Mapbox tokens and signed device validation.

## Acceptance checks

- A wrong password cannot authenticate.
- A valid Supabase user without a matching approved member gets HTTP 403.
- A signed-in owner can load only their own private garage.
- A user cannot upload to another member's vehicle or forge verification status.
- A signed upload URL cannot be used to register another vehicle's media.
- A completed private JPEG upload survives app restart and is visible only to its owner.
- Dev fixture bypass is absent from production/release builds.
- No production territory capture is enabled before evidence and route validation.

**Do not market these workflows as live until actual device and backend tests pass.**
