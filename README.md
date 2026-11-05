# UNDERGROUND

Premium invitation-only iOS social network and real-world territory conquest for verified supercar owners.

**Tagline:** OWNERSHIP IS THE ENTRY.  
**Site:** https://theunderground.vip  
**Bundle ID (proposed):** `vip.theunderground.app`

## Monorepo

| Path | Role |
|------|------|
| `apps/mobile` | Expo + Expo Router iOS app |
| `services/api` | Server-authoritative TypeScript API skeleton |
| `packages/domain` | Shared Zod types / env validation |
| `packages/territory-engine` | Pure deterministic capture / crown engine |
| `packages/ui` | RN-compatible brand primitives |
| `supabase/` | PostGIS migrations, RLS, seed SQL |
| `tests/fixtures` | Draft territories, sim captures, founder garage stubs |
| `docs/` | Product spec, architecture, roadmap, credentials checklist |

## Quick start

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
```

Mobile (requires Expo toolchain):

```bash
pnpm --filter @underground/mobile start
```

API skeleton:

```bash
UNDERGROUND_API_AUTOSTART=1 pnpm --filter @underground/api start
```

Copy `.env.example` → `.env` locally. Do not commit secrets.

## Credentials

See [`docs/CREDENTIALS_NEEDED.md`](docs/CREDENTIALS_NEEDED.md) and [`docs/SETUP_CHECKLIST.md`](docs/SETUP_CHECKLIST.md). Mapbox / Supabase / EAS / Apple credentials are **not** present yet — maps fall back to a dark placeholder; persistence stays dry-run.

## Draft territories

Monterey District seeds are **draft** placeholder LineStrings only. They must not accept production captures until geometries are reviewed.
