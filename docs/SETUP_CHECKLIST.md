# UNDERGROUND — Missing credentials & setup checklist

Status reflects verification during Phase 1 scaffolding. Items stay unchecked until confirmed working. Do not invent credentials.

## Repository

- [x] Dedicated UNDERGROUND GitHub repository created (`KableIX/UNDERGROUND`, not `sakura-harness`)
- [x] Cloud Agent environment pointed at that repo
- [ ] Branch protection / CI secrets configured without committing secrets

## Apple / iOS

- [ ] Apple Developer Program enrollment completed (currently processing)
- [ ] Bundle ID `vip.theunderground.app` registered
- [ ] Development team ID available
- [ ] At least one test iPhone registered (UDID)
- [ ] EAS project linked; credentials via `eas credentials` / secrets
- [ ] Signed internal development build produced and installed (do not claim success until verified)

## Expo / EAS

- [ ] Expo account / org
- [ ] `EXPO_TOKEN` (CI) stored as secret
- [ ] EAS project ID in app config (non-secret) committed; tokens not committed
  - Placeholder currently: `REPLACE_WHEN_EAS_PROJECT_LINKED`

## Supabase

- [ ] Project created (dev)
- [ ] Staging project (optional early; required before staging deploys)
- [ ] Production project (later)
- [ ] `SUPABASE_URL` / anon key / service role via env only
- [ ] PostGIS enabled
- [ ] Private storage buckets for evidence and garage originals
- [ ] Migrations applied; RLS policies reviewed

## Mapbox

- [ ] Mapbox account
- [ ] Public token for map rendering (restricted by bundle ID / URL)
- [ ] Secret token for uploads/styles if needed
- [ ] Native Maps SDK enabled for iOS via Expo config plugin / dev client

## Observability

- [ ] Sentry (or equivalent) org + DSN via env
- [ ] Source maps upload in EAS/CI (when builds exist)

## Content / seed media

- [ ] Licensed or owned photographs for 2010 Audi R8 garage seed
- [ ] Cover / profile imagery for founder seed (or placeholders marked as such)

## Explicit non-claims

- No Mapbox, Supabase, Apple, or EAS credentials exist in this Project yet.
- No iOS build or device install has been verified.
- Monterey route geometries are draft candidates until reviewed with real road-following data.
