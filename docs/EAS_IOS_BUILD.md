# EAS / iOS development build

**Status: NOT installable yet.** EAS project is linked; no signed iOS build has been run. Do not claim device install success. Apple Developer enrollment still processing — no signing / device `eas build` attempted.

## Expo / EAS link (2026-11-05)

| Field | Value |
|-------|--------|
| Auth identity (`eas whoami`) | `underground` (robot) |
| Org / project owner | `undergroundvps-team` (Admin) |
| EAS project | `@undergroundvps-team/underground` |
| `extra.eas.projectId` | `fa7e7c16-cf9d-456b-83c9-4a1c985898c9` |
| Dashboard | https://expo.dev/accounts/undergroundvps-team/projects/underground |
| Bundle ID | `vip.theunderground.app` (unchanged) |
| `eas.json` profiles | development/internal preserved (`developmentClient: true`, `distribution: internal`, `ios.simulator: false`) |

### Token presence (this agent)

- `EXPO_TOKEN` (uppercase): **unset** in process env
- `expo_token` (lowercase secret injection): **present**, length **40** (value never logged)
- CLI auth: export `EXPO_TOKEN="$expo_token"` then `npx eas-cli whoami` → success

### Link procedure used

1. Cleared invalid placeholder `REPLACE_WHEN_EAS_PROJECT_LINKED` (not a UUID; blocked GraphQL).
2. `pnpm install` (eas init needs `expo-router` resolvable).
3. `npx eas-cli init --account undergroundvps-team --non-interactive --json --no-icon`
   - Account `underground` cannot create projects; only `undergroundvps-team` is permitted.
   - Result: **created** `@undergroundvps-team/underground` and wrote real `projectId` + `owner`.
4. `eas.json` untouched. No Apple signing / device build.

## Exact config (committed)

### `apps/mobile/app.json` (relevant)

- `ios.bundleIdentifier`: `vip.theunderground.app`
- `owner`: `undergroundvps-team`
- `extra.eas.projectId`: `fa7e7c16-cf9d-456b-83c9-4a1c985898c9`

### `apps/mobile/eas.json`

```json
{
  "cli": { "version": ">= 14.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": false },
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "APP_ENV": "staging" }
    },
    "production": {
      "env": { "APP_ENV": "production" }
    }
  },
  "submit": { "production": {} }
}
```

## Commands (when Apple ready)

```bash
cd apps/mobile
export EXPO_TOKEN="$expo_token"   # or inject uppercase EXPO_TOKEN into the environment
npx eas-cli whoami
npx eas-cli project:info
# ONLY after Apple membership is active — not run yet:
# npx eas-cli build --platform ios --profile development
```

## CI results

GitHub Actions CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test` only. **No EAS build job is configured.** Prefer injecting secret as uppercase `EXPO_TOKEN` for CI/agents; this VM currently receives lowercase `expo_token`.

## Remaining blockers (precise)

1. Prefer environment secret named **`EXPO_TOKEN`** (uppercase) so agents need no remapping — currently only `expo_token` is injected
2. Apple Developer Program enrollment still processing — **no device signing / `eas build` for device attempted**
3. Apple Team ID missing
4. Bundle ID `vip.theunderground.app` registration not confirmed in Apple portal
5. No test iPhone UDID registered
6. Runtime Mapbox/Supabase remain stubbed (not required for EAS project link)

## iPhone install procedure (conditional — only after signed build succeeds)

1. Complete Apple blockers above.
2. `eas build -p ios --profile development` produces an internal distribution artifact.
3. Register device UDID in Apple portal / EAS credentials.
4. Install via EAS QR / `eas device:create` + build page link, or Apple Configurator.
5. Trust developer certificate on device; launch UNDERGROUND.

**Until step 2 produces a successful signed artifact, install is blocked.**
