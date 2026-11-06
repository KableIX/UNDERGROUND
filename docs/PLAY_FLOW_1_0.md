# PLAY 1.0 — One-screen discovery

PLAY is the single entry point to the curated event catalog. The MAP tab remains geographic navigation.

- **Region:** California, explicitly shown at top (only region included in the POC).
- **Area:** Horizontal selector: Peninsula Coast (default), Silicon Valley, Napa Valley, Monterey Peninsula.
- **Conquests:** RUNS / CRUISES / POC categories directly underneath. Cards change in place without drilling through three pages.
- **Details:** Tapping a photo card opens the existing full event detail; the back action honors the iPhone top safe area.
- The old `/runs` catalog route redirects to `/(tabs)/conquest` to prevent duplicate UI and old overlapping headers.
- NVIDIA's original circuit is under Silicon Valley → POC, not normal RUNS. A separate dev-map action is available there.
- No routes become capturable through this navigation change.

## Device acceptance

1. Tap PLAY. Immediately see California, area chips, and photo-backed runs on the same screen.
2. Peninsula defaults to Half Moon Bay Coast and Pescadero, not a map or long explanatory text.
3. Tap Silicon Valley → POC to find NVIDIA Campus Loop.
4. Tap Monterey → CRUISES to see 17-Mile Drive.
5. Tap event: detail loads, back works, no status-bar overlapping text.
6. Tap MAP: original geographic map and current-location controls remain unchanged.

This solves previously reported nested navigation and oversized/clipped title on the old /runs page. It requires on-device screenshot validation.
