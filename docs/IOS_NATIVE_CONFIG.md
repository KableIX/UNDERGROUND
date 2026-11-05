# iOS native configuration — UNDERGROUND

**Bundle:** `vip.theunderground.app`  
**EAS projectId:** `fa7e7c16-cf9d-456b-83c9-4a1c985898c9`  
**Owner:** `undergroundvps-team`  
**No Apple signing in this pass.** Production captures remain disabled.

## Configured in `apps/mobile/app.json` (implemented)

| Capability | Status | Notes |
|------------|--------|-------|
| Location when-in-use / always strings | Present | Run verification copy |
| `UIBackgroundModes: location` | Present | Background GPS **entitlement + device test still required** |
| Camera / Photo Library strings | Present | Evidence + garage |
| `expo-dev-client` | Present | Required for Mapbox / native modules |
| Splash / icon | Present | Dark brand plate |
| ITSAppUsesNonExemptEncryption | false | Export compliance stub |

## Not yet wired as Expo packages (documented needs)

| Capability | Package / API | Blocker |
|------------|---------------|---------|
| Background GPS + motion | `expo-location`, `expo-sensors` | Device + Apple; motion permission string TBD |
| Camera capture | `expo-camera` / `expo-image-picker` | Device verification |
| Mapbox native maps | `@rnmapbox/maps` + token | `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` |
| Push notifications | `expo-notifications` + APNs | Apple Team + push cert/key |
| Offline storage | `expo-sqlite` / SecureStore + file cache | Architecture ready; not device-verified |
| CarPlay | entitlement + Mapbox CarPlay | **Architecture only** — no entitlement assumed |
| Upload to private buckets | Supabase signed URLs | Supabase credentials |

## expo-doctor

Last known green on branch: **18/18** (prior UG-16 pass). Re-run after dependency changes:

```bash
cd apps/mobile
npx expo-doctor
npx expo export --platform ios
```

## Device / Apple entitlement checklist (blocked)

1. Apple Developer membership active + Team ID  
2. Register bundle `vip.theunderground.app`  
3. Device UDID(s) for internal distribution  
4. EAS credentials / `eas device:create`  
5. Background location purpose string review  
6. Push (APNs) key if enabling notifications  
7. CarPlay entitlement **only if/when approved** — do not ship assuming grant  
8. Mapbox token + secret (never commit)

## Verification labels

| Claim | Label |
|-------|-------|
| Metro iOS export | **implemented** (prior pass) |
| expo-doctor | **implemented** (re-verify after installs) |
| Signed device install | **blocked — Apple** |
| Background GPS on device | **untested-on-iOS** |
| Mapbox satellite live | **untested** without token |
| Production capture | **disabled** |
