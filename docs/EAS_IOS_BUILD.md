# EAS / iOS development build

**Status: NOT installable yet.** EAS project is linked; Apple Team ID is known; **no signed IPA** — blocked on interactive Apple login + device registration. Do not claim device install success. Canonical first-build stop doc (Project store): `docs/FIRST_IOS_BUILD.md` on the coordinator store.

## Expo / EAS link (verified 2026-11-05)

| Field | Value |
|-------|--------|
| Auth identity (`eas whoami`) | `underground` (robot) |
| Org / project owner | `undergroundvps-team` (Admin) |
| EAS project | `@undergroundvps-team/underground` |
| `extra.eas.projectId` | `fa7e7c16-cf9d-456b-83c9-4a1c985898c9` |
| Dashboard | https://expo.dev/accounts/undergroundvps-team/projects/underground |
| Bundle ID | `vip.theunderground.app` (unchanged) |
| Apple Team ID | `2TZCY23DP9` (`eas.json` development `env.EXPO_APPLE_TEAM_ID`) |
| `eas.json` profiles | development/internal preserved (`developmentClient: true`, `distribution: internal`, `ios.simulator: false`) |

### Token presence

- Prefer uppercase `EXPO_TOKEN` in the environment.
- If only lowercase `expo_token` is injected: `export EXPO_TOKEN="$expo_token"` (never print the value).

## Exact config (committed)

### `apps/mobile/app.json` (relevant)

- `ios.bundleIdentifier`: `vip.theunderground.app`
- `owner`: `undergroundvps-team`
- `extra.eas.projectId`: `fa7e7c16-cf9d-456b-83c9-4a1c985898c9`

### `apps/mobile/eas.json` (development)

- `developmentClient: true`, `distribution: internal`, `ios.simulator: false`
- `env.APP_ENV`: `development`
- `env.EXPO_APPLE_TEAM_ID`: `2TZCY23DP9`

## TJ interactive steps (required before signed build)

### 1) Apple credentials (`eas credentials`)

```bash
cd apps/mobile
npx eas-cli credentials -p ios
```

Official prompts:

1. Build profile → **development**
2. `Do you want to log in to your Apple account?` → **Y**
3. `› Log in to your Apple Developer account to continue` / `? Apple ID: ›`
4. Complete Apple password + 2FA **locally** (never paste into chat)
5. Select Team **`2TZCY23DP9`**; let EAS manage cert + ad hoc profile / register bundle ID

### 2) Device registration (`eas device:create`) — user-interactive

```bash
npx eas-cli device:create
```

- Use account `undergroundvps-team`
- Prefer **Website** registration (QR/URL) → open on iPhone → Download/Install profile
- Confirm with `npx eas-cli device:list`

### 3) Build

```bash
npx eas-cli build --platform ios --profile development
```

Non-interactive builds fail until credentials + device exist:

> Failed to set up credentials. You're in non-interactive mode. EAS CLI couldn't find any credentials suitable for internal distribution.

## Remaining blockers

1. Interactive Apple Developer login / 2FA (TJ)
2. At least one device via `eas device:create` (TJ)
3. Bundle ID registration confirmation via EAS Apple session
4. Prefer uppercase `EXPO_TOKEN` injection for agents/CI
5. Mapbox/Supabase optional for first install (stubs/fallbacks OK)
6. Production captures remain disabled

## Post-install checks (only after TJ confirms)

Launch · Newswire/Conquest/Garage/Friends/Rankings · Founder garage · SV map · sim capture (prod captures off).
