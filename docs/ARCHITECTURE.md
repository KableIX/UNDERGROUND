# UNDERGROUND — Architecture

## Monorepo layout

```
apps/mobile              Expo / React Native / TypeScript (Expo Router)
services/api             TypeScript server-authoritative gameplay API
packages/domain          Shared types, schemas, contracts
packages/territory-engine  Pure deterministic capture / crown logic
packages/ui              Shared UI primitives (RN-compatible)
supabase/migrations      PostgreSQL + PostGIS + RLS
tests/fixtures           GPS sims, seed territories, mock evidence
docs                     Specs, ADR, roadmap
```

## Stack

| Layer | Choice |
|-------|--------|
| Mobile | Expo + Expo Router, development builds, EAS Build (iOS) |
| Maps | Mapbox Maps via compatible native/dev-build integration |
| Auth / DB / Storage | Supabase Auth, PostgreSQL, PostGIS, private Storage, RLS |
| API | TypeScript services; server adjudicates captures |
| Package manager | pnpm workspaces |
| Tests | Vitest (domain); integration tests for DB/API |
| CI | GitHub Actions |
| Observability | Sentry (or equivalent) |

## Trust boundaries

- **Client:** UI, local recording buffers, optimistic display. Never authoritative for ownership, scores, or entitlements.
- **API:** Idempotent command handlers; transactional adjudication; audit writes.
- **DB:** RLS for member-scoped reads/writes; service role only on the API for privileged gameplay mutations.
- **Storage:** Private buckets for original evidence; sanitized opt-in public derivatives only.

## Territory engine

- Immutable versioned territory definitions.
- Solo ownership and independent club ownership tracks.
- Capture / challenge / defense / takeover with weighted points.
- District crown only when an owner holds **>50%** of eligible territory weight; else neutral.
- Immutable ownership + scoring ledgers; full audit history.
- Concurrent claim resolution inside transactions; deterministic replay.

## Verified run pipeline

```
CREATED → START_VERIFIED → RECORDING → ROUTE_COMPLETE
  → FINISH_PENDING → EVIDENCE_REVIEW → ACCEPTED | REJECTED
```

Production evidence includes start/end odometer photos, ordered checkpoints, background GPS, finish-zone detection, parking window for finish photo, GPS↔odometer consistency, server challenges, fraud/replay checks. Development uses simulated GPS fixtures and mock camera evidence, gated so sims cannot write production ownership.

## Environments

Separate development / staging / production configs. Secrets via env validation only; never committed.
