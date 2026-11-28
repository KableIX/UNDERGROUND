# SupercarGO scan: native modules and the new development build

The scan flow adds four native modules. They only exist in a development build made
after they were added, so every use is behind a fallback and the previous build keeps
working.

| Module | Used for | Fallback on an older build |
|---|---|---|
| `expo-camera` | Live in-app viewfinder on Log a sighting, camera only, opens straight to scan | System camera opens at once (as before) |
| `expo-sensors` | Foil follows the tilt of the phone | Foil drifts on its own |
| `expo-haptics` | Taps on shutter, lock, reveal and card (heavier for rare tiers) | No haptics |
| `react-native-view-shot` | SHARE sends the Underground card as an image | Text plus the blurred photo, as before |

Foil by tier: Atelier and Singular full holo; Numbered and Allocated foil edge; Open and
Limited matte. Reduce Motion freezes everything.

Share image: the card is rendered off screen without its area line, so a shared card never
shows a place. The photo on it is the plate- and face-blurred copy, never the original.

## Making the build (EAS cloud, same path as earlier builds)

The EAS project is `@undergroundvps-team/underground`, bundle `vip.theunderground.app`,
Apple team `2TZCY23DP9`. Credentials and the registered iPhone already live on Expo from
the earlier builds, so this is one command. It needs an Expo login for the
`undergroundvps-team` account: either `npx eas-cli login` on the build machine, or an
`EXPO_TOKEN` in the environment (never commit or print it).

```powershell
cd E:\underground\UNDERGROUND\apps\mobile   # any checkout of main
npx eas-cli whoami
npx eas-cli build --platform ios --profile development --non-interactive
```

Notes:

- Free-plan builds queue at low priority and cost nothing. Do not buy priority or extra
  build credits for this. If EAS offers to, decline.
- No Mapbox download token is set on EAS, so the native Mapbox plugin is not linked and
  the map uses Apple MapKit, same as the last build.
- When it finishes, open the build page on the iPhone (Safari) and tap Install. The
  phone must be registered for ad hoc distribution (`npx eas-cli device:list`).
- After installing, start the dev server (`underground-expo` on Atlas) and open the app.

## Checks run before building

```powershell
corepack pnpm -C apps/mobile test
corepack pnpm -C apps/mobile typecheck
cd apps/mobile; npx expo-doctor; npx expo export --platform ios --output-dir $env:TEMP\ug-ios-export
```
