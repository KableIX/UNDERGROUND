# UNDERGROUND — Map-First Acceptance Gate

**Decision:** Establish a complete, interactive global map before adding territory layers.

## Phase 1 (this branch)

- The tab formerly titled CONQUEST is temporarily labeled **MAP**; route path `/(tabs)/conquest` stays unchanged for compatibility.
- Render **real Apple MapKit vector/road tiles** on iOS through `react-native-maps` without needing Mapbox credentials.
- Standard Roads, Satellite and Hybrid basemaps; free worldwide pan/zoom; World View and Santa Clara preset; on-demand My Location.
- Do not request location permission on map opening. A user action is required.
- Drive preview can record foreground GPS in memory only; it has no backend ownership or persistent trip history.
- No territory geometry, ownership state, draft route lines, or challenge controls are rendered in the active Map view.
- Old conquest modules, validation engines, data fixtures and server-side protection remain in the repository but are not accessible from this screen.
- The updated iOS configuration contains no background-location entitlement.

## Device acceptance before territories

1. Install this signed build on the registered iPhone using the existing Apple Developer signing setup.
2. Open MAP and verify actual road tiles and street labels around Santa Clara, not a simulated map or static image.
3. Pan and zoom to an unrelated city or country. Zoom in to road level and back out again without camera snapping to Santa Clara.
4. Toggle ROAD / SATELLITE / HYBRID and verify each style renders.
5. Press WORLD VIEW and verify the global camera reset, then return to SANTA CLARA.
6. Press MY LOCATION; allow **When In Use**. Verify the displayed position, no permission prompt on initial map open.
7. Confirm the map works with Mapbox pk/sk variables *absent*.
8. Enter DRIVE; test Start/Pause/Resume/End while stationary or as a passenger. Do not operate the UI while driving. Verify no score or owner changes.
9. Background the app: recording must pause; verify no background location indicator.
10. Rotate/pan/zoom the map for at least a few minutes and check for native crashes, map blanking and repeated map remounting.

## Phase 2 — after map device acceptance

Layer operator-defined route territories onto the **same** basemap with versioned GeoJSON. Only the `conquest` mode should show ownership and approved territory geometry. The geographic basemap must never be cropped to those definitions. Keep all production capture gates closed until real GPS/odometer/photo verification and road geometry are independently validated.

## Release blockers

Physical iPhone acceptance is pending. Live Supabase and Mapbox integration are independent follow-ups. Trips are not persisted in this phase; Cursor's trip-history work targets that separately.
