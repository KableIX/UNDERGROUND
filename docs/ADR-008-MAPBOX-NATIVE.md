# ADR-008: Native Mapbox for Conquest v2

- **Status:** Accepted (implementation on `feature/conquest-v2-mapbox`)
- **Context:** Static-image + projected SVG fallback is insufficient for a cinematic tactical territory map. Need pan/zoom, satellite, GeoJSON routes, selection illumination, start/finish markers.
- **Decision:**
  - Depend on `@rnmapbox/maps@10.1.39` (Expo 52 / RN 0.76 peer range; **device compatibility unverified in CI**).
  - Expo config plugin via `app.config.ts` with `RNMapboxMapsVersion: 11.8.0`.
  - Public runtime token: `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (pk.*).
  - Private download token: `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (sk.*) — EAS secret only, never committed.
  - Graceful `TacticalMapPlane` fallback when token/native module missing.
  - **Requires a new custom development client** (Expo Go unsupported).
- **Consequences:** Rebuild iOS with EAS development profile after this change; Mapbox secrets must exist in EAS env; Linux Metro export uses fallback path.
