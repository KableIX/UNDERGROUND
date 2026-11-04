# EAS / iOS development build

**Status: NOT installable yet.** No signed iOS build has succeeded in this environment. Do not claim device install success.

## Exact config (committed)

### `apps/mobile/app.json` (relevant)

- `ios.bundleIdentifier`: `vip.theunderground.app`
- `extra.eas.projectId`: `REPLACE_WHEN_EAS_PROJECT_LINKED` (placeholder — not a real EAS id)

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

## Commands (when credentials exist)

```bash
cd apps/mobile
npx eas-cli login          # requires Expo account
npx eas-cli init           # link real project; replace REPLACE_WHEN_EAS_PROJECT_LINKED
npx eas-cli build --platform ios --profile development
```

Optional local check (still needs Apple/Expo auth for device builds):

```bash
npx eas-cli build --platform ios --profile development --non-interactive
```

## CI results

GitHub Actions CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test` only. **No EAS build job is configured** (no `EXPO_TOKEN`).

## Blockers (precise)

1. Expo account / org not linked
2. `EXPO_TOKEN` missing (CI + CLI)
3. Real EAS `projectId` not issued (`REPLACE_WHEN_EAS_PROJECT_LINKED` remains)
4. Apple Developer Program enrollment still processing
5. Apple Team ID missing
6. Bundle ID `vip.theunderground.app` registration not confirmed
7. No test iPhone UDID registered
8. No Mapbox/Supabase secrets required for a shell build, but runtime map/auth remain stubbed

## iPhone install procedure (conditional — only after signed build succeeds)

1. Complete Apple + EAS blockers above.
2. `eas build -p ios --profile development` produces an internal distribution artifact.
3. Register device UDID in Apple portal / EAS credentials.
4. Install via EAS QR / `eas device:create` + build page link, or Apple Configurator.
5. Trust developer certificate on device; launch UNDERGROUND.

**Until step 2 produces a successful signed artifact, install is blocked.**
