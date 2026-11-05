# UNDERGROUND Full-Map Modes — Development Design

**Branch:** `feature/full-world-map-modes`

The geographic map covers the entire world, independently of the hand-curated territory dataset. No hex-grid ownership and no road-level automatic territory claims.

## Modes

- **Explore:** Global pan/zoom/rotate on a geographic basemap, no conquest overlays. Does not request location access.
- **Drive:** The same full map, opt-in foreground GPS recording with Start/Pause/Resume/End, quality/distance/duration indicators, optional user-location display. Automatically pauses when the app becomes inactive or user switches away from Drive. No background capture, persistence, or rewards in this milestone.
- **Conquest:** The same basemap, only approved/draft operator-authored territory lines as overlays; separate solo/club mode, development-only sim capture. Production capture stays blocked.

## Map providers

1. **Mapbox native**: Preferred when the public runtime token and private native download token were provided at build time and the native module is actually linked. Mapbox styles and route overlays are used only for curated routes.
2. **Apple Maps / react-native-maps**: Full geographic road basemap on iOS with no Mapbox account, plus selected route overlays only in Conquest. A new signed development build must contain react-native-maps.
3. **Legacy tactical plane**: Final compatibility fallback when an old signed client lacks both native map modules. This is not a full road map and must be labeled clearly.

## Trust and safety

- Route-line geometry is currently marked DRAFT and NOT road-snapped.
- Foreground GPS samples remain local in volatile state; no database storage or authoritative run verification.
- GPS movement, duration, and distance do not award CLOUT or change ownership.
- A private speed reading is available in the GPS hook but not used for territory scoring.
- Never invent map roads, production geofence approvals, or verified ownership.
- Ask foreground location permission only after the member taps Start Drive.
- Background recording is explicitly disabled. Additional background permissions, durable offline trip storage, and battery tests require a separate native milestone.

## Test plan

- Install a new signed iOS development build (native `react-native-maps` and `expo-location` modules).
- Verify Explore opens on an actual full road map and can freely pan/zoom away from Silicon Valley.
- Verify Drive asks permission on Start; Pause and End release GPS subscription; moving away from Drive pauses recording.
- Verify Conquest overlays only defined territories, and world map still permits navigating elsewhere.
- Verify SV DEV sim->Newswire still works and production capture remains blocked.
- Verify unavailable native map modules show labeled fallback instead of crashing the existing client.
