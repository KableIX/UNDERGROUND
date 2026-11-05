# UNDERGROUND Supabase authorization audit — 2026-11-04

Scope: reviewed migrations 00002–00010, backend member authorization, garage media lifecycle, and mobile GaragePhotoUpload. This is a source and disposable-PostGIS audit, not a live Supabase penetration test. No Supabase production project or secrets were accessed; no cloud migrations were applied.

## Confirmed risks
1. **Critical — vehicle self-verification:** `vehicles_owner_write FOR ALL` allows the owner to UPDATE `verification_status`. Mitigated in migration 00009 by a privileged-only transition guard.
2. **High — friendship self-acceptance:** `friendships_update_participants` allows requester to set `status='accepted'`. Migration 00009 restricts client UPDATE to addressee and pending -> accepted/rejected, and prevents participant swaps.
3. **Defense in depth — vehicle ownership mutation:** the existing owner-write policy's WITH CHECK blocks transferring to another member for ordinary authenticated users. Migration 00009 additionally enforces owner-ID immutability for non-service roles, independent of policy configuration.
4. **Partially addressed — API authentication:** live `/v1/me`, `/v1/garage/media/upload-intent`, and `/v1/garage/media/complete` now validate bearer sessions through Supabase Auth, resolve approved member identity, and verify vehicle ownership before issuing signed upload links or registering existing objects. Other sensitive mutations remain fail-closed. These paths have mocked unit tests but still need genuine Supabase integration and rate limits.
5. **Medium — Top 8:** `profiles.top_eight` limits count but does not validate friendship, uniqueness, or membership existence. Implement server-validated mutation.
6. **Medium — public profile exposure:** `profiles_select_authenticated USING(true)` exposes all profile rows to every authenticated user. Introduce a safe public projection and private profile fields before adding sensitive data.
7. **Medium — private originals:** garage bucket SELECT is owner-only, so friends cannot read originals directly (good). Generate expiring signed URLs for authorized friends only after checking vehicle visibility and friendship. Strip EXIF/GPS from public derivatives.
8. **Medium — evidence uploads:** evidence bucket has no client policy (good); service-role signing endpoint still needs authenticated run ownership and state checks.
9. **High — ledger enforcement:** `runs.evidence_source` comment is not a database invariant. API/engine simulation gates exist, but privileged SQL writers could still mutate production ownership. Add DB transaction procedures/constraints for adjudication before launch.

## Migration created
`supabase/migrations/20261105000009_sensitive_state_hardening.sql` and `20261105000010_media_finalize_security.sql` (applied only to disposable PostGIS; not deployed to Supabase).
It narrows friendship update permissions, blocks client vehicle self-verification on INSERT and UPDATE, prevents client-created friendships from starting as accepted, and prevents direct mutation of profile counters and Top 8. All require database-level integration tests.

## Disposable PostgreSQL validation completed

Applied migrations 00001–00010 to a disposable local PostGIS 16 database with stubbed Supabase `auth` and `storage` roles/functions. Ran `tests/supabase-authz-postgres.sql` with `ON_ERROR_STOP=1`: all seven authorization scenarios passed (block verified INSERT, verified UPDATE, social-count forgery, pre-accepted friendship INSERT, requester self-acceptance; allow recipient acceptance and block subsequent transition). Test transaction rolled back.

**Scope limitation:** This emulates Supabase identity functions. It does not replace an actual Supabase storage/auth integration test or validate signed URLs/JWT services. Production remains blocked until those tests pass.

## Validation required
- Apply migrations to a disposable Supabase/Postgres instance with Supabase auth/storage roles.
- Test requester cannot accept their own invitation; recipient can accept pending once; requester cannot change participant IDs.
- Test owner cannot set vehicle `verification_status='verified'` or change owner.
- Test privileged backend can execute authorized verification and transfer flows.
- Test unauthorized upload intent and signed URL issuance return 403.
- Test RLS for anonymous, authenticated owner, accepted friend, nonfriend, and service role.
- Review SQL functions and security definer privileges with database role simulation.

## Current release verdict
**BLOCKED for live persistence** until the migration and API authorization are integration-tested. Existing fixture/demo screens remain usable. Do not expose Supabase service-role keys to the mobile app.
