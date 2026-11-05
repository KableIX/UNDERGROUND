# EAS build readiness checklist

**Goal:** first real iPhone development-client install for UNDERGROUND.  
**Status:** project linked; **not** signed / not installable yet. Do **not** claim device install success.  
**Hard rule:** no Apple signing / `eas build` for device until Apple membership is active and this checklist is green.

## Identity (do not change)

| Field | Value |
|-------|--------|
| Bundle ID | `vip.theunderground.app` |
| Expo owner | `undergroundvps-team` |
| EAS project | `@undergroundvps-team/underground` |
| `extra.eas.projectId` | `fa7e7c16-cf9d-456b-83c9-4a1c985898c9` |
| Dashboard | https://expo.dev/accounts/undergroundvps-team/projects/underground |

## Product gates for first iPhone test (sim only)

- [x] Silicon Valley development district map (dark tactical; Mapbox satellite when token present; dark fallback without)
- [x] Selectable illuminated SV routes; production captures hard-blocked
- [x] Founder `#000001` / STARK garage seed + private storage upload contracts / mobile ADD PHOTO UI (placeholders without Supabase)
- [x] Simulated territory capture → Newswire (`sim_capture_v1`) end-to-end in app + API + fixtures
- [x] Tabs: Newswire · Conquest · Garage · Friends · Rankings (Profile hidden from tab bar)
- [x] Sim vs production hard-gated (dev district + `ownershipWriteAllowed: false` + CLOUT +0 on sim)

## Credentials / secrets

| Secret | Needed for | Status |
|--------|------------|--------|
| `EXPO_TOKEN` (prefer uppercase) | EAS CLI auth | Prefer uppercase injection; lowercase `expo_token` may be remapped locally — **never print** |
| Apple Team ID | Device signing | **`2TZCY23DP9`** in development profile env — interactive Apple login still required |
| Apple Device UDID(s) | Internal distribution | Missing — `eas device:create` (user-interactive) |
| Bundle ID registered in Apple portal | Signing | Unconfirmed until EAS Apple session |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Satellite map plane | Optional for first install; dark fallback works |
| Supabase URL + anon + service role | Live garage upload / persistence | Optional for first install; placeholder planner works |
| Sentry DSN | Crash reporting | Optional |

## EAS profile sanity (`apps/mobile/eas.json`)

- [x] `development`: `developmentClient: true`, `distribution: internal`, `ios.simulator: false`
- [x] Preview / production profiles present
- [x] `expo-dev-client` dependency present (required by development profile)
- [x] Icon / splash placeholders under `apps/mobile/assets/`
- [x] iOS Info.plist usage strings: location, camera, photo library
- [x] `expo-doctor` 18/18; `npx expo export --platform ios` bundles cleanly
- [x] Apple Team ID `2TZCY23DP9` in development `env.EXPO_APPLE_TEAM_ID`
- [ ] Credentials source configured in Expo (TJ: `eas credentials -p ios` + Apple login/2FA)
- [ ] Ad-hoc provisioning for test iPhone (after Apple login)
- [ ] Device UDID registered via `eas device:create`

## Pre-build commands (no secrets printed)

```bash
cd apps/mobile
# Prefer uppercase EXPO_TOKEN in the environment. If only expo_token exists:
# export EXPO_TOKEN="$expo_token"
npx eas-cli whoami
npx eas-cli project:info
pnpm -C ../.. test
pnpm -C ../.. typecheck
pnpm -C ../.. lint
npx expo-doctor
npx expo export --platform ios --output-dir /tmp/ug-ios-export
```

## Exact first signed EAS commands (later — Apple ready only)

```bash
cd apps/mobile
export EXPO_TOKEN="$expo_token"   # or inject uppercase EXPO_TOKEN; never print
npx eas-cli whoami
npx eas-cli project:info
npx eas-cli device:create
npx eas-cli build --platform ios --profile development
# After build succeeds: install via EAS QR / link, trust developer cert, launch.
```

## Explicitly NOT run yet

```bash
# DO NOT RUN until Apple membership + Team ID + device UDID are ready:
# npx eas-cli build --platform ios --profile development
# npx eas-cli device:create
```

## After a successful signed artifact (conditional install)

1. Register test iPhone UDID in Apple / EAS.
2. Install via EAS build page QR / link or Apple Configurator.
3. Trust developer certificate on device.
4. Launch UNDERGROUND — verify tabs, SV map fallback/satellite, garage placeholders, sim capture → Newswire.
5. Confirm production capture CTAs remain blocked.

## CI note

GitHub Actions runs `pnpm lint`, `pnpm typecheck`, `pnpm test` only. **No EAS build job** is configured. Keep it that way until Apple signing is authorized.

## Related docs

- [`EAS_IOS_BUILD.md`](./EAS_IOS_BUILD.md) — link history + blockers
- [`CREDENTIALS_NEEDED.md`](./CREDENTIALS_NEEDED.md)
- [`SETUP_CHECKLIST.md`](./SETUP_CHECKLIST.md)
