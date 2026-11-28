# Atlas deploy plan for the UNDERGROUND app API

Status as of Friday, Nov 27, 2026, 8:02 AM PT (Atlas clock: 11:02 AM Eastern): this is a plan only. Nothing in this document is a go-ahead to restart, overwrite, or expose the service.

The Hostinger invite site at https://theunderground.vip stays on Hostinger. This plan covers `services/api` only.

## What is already on Atlas (read-only check)

Reached from AngelFire with `wsl ssh god@10.0.0.93` (Windows `ssh` is refused).

- Host: Atlas, Ubuntu 22.04, user `god`, Linux 6.8.0-90-generic.
- Node: v22.22.2 (`/usr/bin/node`). npm: 10.9.7. `corepack` is at `/usr/bin/corepack`. `pnpm` was not on `PATH`.
- App tree: `/data/underground` is a monorepo copy (apps, packages, services, supabase, tests, `node_modules`) dated Nov 25, 2026. It is **not** a git checkout.
- **Current deploy (Nov 27, 2026):** the API runs from the git checkout `/data/underground-git` (main) as the **user** unit `~/.config/systemd/user/underground-api.service` (`systemctl --user restart underground-api`). It sets `UNDERGROUND_ROOT=/data/underground-git`; the unit template in `scripts/atlas/underground-api.service` now points there. `/data/underground` is only the Expo copy of `apps/mobile`.
- Local helper tree: `/data/underground-local-backend/supabase`.
- Tools and a DB unit: `/data/underground-tools/`, including `underground-db-local-only.service` and `/data/underground-start.sh`.
- Env file (do not commit, do not print): `/home/god/.config/underground/api.env`.
- Tailscale is up (address `100.77.37.88`, Caddy also listening on that address at 443, 8080, 8084, 8085).

### The API is already running

`GET http://127.0.0.1:8787/health` returned HTTP 200:

- `service`: `underground-api`
- `appEnv`: `staging`
- `supabaseReady`: true
- persistence: Cloud Supabase + PostGIS, durable writes via the service-role API

`ss` shows `node` listening on `0.0.0.0:8787` (all interfaces). That is the default `API_HOST`/`API_PORT` from `packages/domain/src/env.ts`.

Ports already in use (do not steal these without a plan):

- `8787` — underground-api (current)
- `54321` / `54322` — look like local Supabase
- `4000` on `127.0.0.1` — a separate Python service (`{"ok":true}`), not the Node API
- `8080` / `8084` / `8085` / `443` — Caddy (mostly on the Tailscale address)

A later cutover should update `/data/underground` to a git checkout of `release/2026-11-27` (or `main` after it is pointed there) and restart the unit. That step needs an explicit go and is **not** done here.

## Runtime

- Start command: `UNDERGROUND_API_AUTOSTART=1 pnpm --filter @underground/api start` (tsx runs `services/api/src/index.ts`).
- Set `UNDERGROUND_API_AUTOSTART=0` only when importing the module from tests.
- Working directory: `/data/underground` (the monorepo root, because of workspace packages).
- If `pnpm` is missing: `corepack enable` and `corepack prepare pnpm@latest --activate` (pin the version after the first successful enable).

## Environment variable names

Load from `/home/god/.config/underground/api.env`. Do not put values in git, chat, or the unit file.

Required for a real (non dry-run) API:

- `NODE_ENV`
- `APP_ENV`
- `API_HOST` (default `0.0.0.0`)
- `API_PORT` (default `8787`)
- `API_PUBLIC_URL` (public or Tailscale URL the iOS app will call)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional / feature-specific (names only):

- `MAPBOX_ACCESS_TOKEN`
- `SENTRY_DSN`
- `NEWSWIRE_EDITORIAL_TOKEN_SHA256` (hash only; used by the editorial route)
- `SPOTTED_VISION_URL`
- `SPOTTED_VISION_MODEL`
- `SPOTTED_VISION_KEY`
- `DATABASE_URL` (if anything talks to local Postgres; the live health check said Cloud Supabase)
- `UNDERGROUND_API_AUTOSTART`

The mobile app also needs `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, and `API_PUBLIC_URL` / `EXPO_PUBLIC_*` equivalents in the EAS/app build. Those are client-side and are a separate build, not this systemd unit.

## Supabase

The running health check already reports Cloud Supabase + PostGIS, not the Atlas local stack, as the gameplay backend. `/data/underground-local-backend` and ports 54321/54322 look like a local helper. Leave them alone unless a later task is explicitly about local DB. Migrations live in `supabase/migrations/` in this repo and must be applied on the Cloud project with a separate go.

## systemd

A starter unit is in `scripts/atlas/underground-api.service`. It reads the existing env file and runs `scripts/atlas/start-underground-api.sh`.

Install later (needs go; do not run now):

```bash
sudo cp /data/underground/scripts/atlas/underground-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now underground-api
```

There is already `underground-db-local-only.service` under `/data/underground-tools/`. Do not replace or stop it as part of an API restart unless that is asked for.

## How the mobile app should reach it

Today the process is bound to `0.0.0.0:8787` with no TLS on that port. Do not leave that as the long-term public entry.

Preferred options, in order:

1. **Subdomain + TLS (needs TJ's DNS go):** `api.theunderground.vip` → Atlas (or a Caddy listener already on Tailscale `:443`). Caddy reverse-proxies to `127.0.0.1:8787`. Then set `API_PUBLIC_URL=https://api.theunderground.vip` and rebuild the iOS app with that public URL. The apex `theunderground.vip` invite site stays on Hostinger; do not move it.
2. **Tailscale only:** keep the API off the public internet. Point `API_PUBLIC_URL` at `https://<atlas-tailscale-name>` or `http://100.77.37.88:8787` behind Caddy. Fine for beta devices on Tailscale, not for TestFlight at large.
3. **LAN only:** `http://10.0.0.93:8787` from AngelFire / in-house devices. Not for production.

Bind `API_HOST=127.0.0.1` once Caddy (or another proxy) is in front, so 8787 is not exposed raw on the LAN/WAN.

## Cutover checklist (future go only)

1. `git clone` or `git fetch` this repo into `/data/underground` (or a sibling directory), checkout `main` or `release/2026-11-27`.
2. `pnpm install --frozen-lockfile`.
3. Confirm `/home/god/.config/underground/api.env` has the names above (do not echo it).
4. `curl -sS http://127.0.0.1:8787/health` and record the current response.
5. Install the systemd unit, restart, and re-check `/health`.
6. Only after a DNS go: add the Caddy site and `api.theunderground.vip`.
7. Point the mobile app's `API_PUBLIC_URL` at the chosen URL and ship a new EAS build.

Do not run those steps from this change set.