# PLAY 1.0 — Region → Area → Conquests

PLAY is **not** the geographic MAP tab. Its landing is a three-stage selection experience:

1. **Select Region** — California (only supported development region for 1.0).
2. **Select Area** — Silicon Valley, Peninsula Coast, Napa Valley, Monterey Peninsula.
3. **Select Conquest** — a curated candidate in the chosen territory area. Runs, Cruises and POC Tests are distinct categories and are only shown where catalog entries exist.

Each area opens a photo-backed list filtered from `apps/mobile/src/data/curated-runs.ts`. The selected event opens its details. All cards remain draft/non-capturable until route geometry and road suitability are approved.

A separate development map can be opened explicitly from the Silicon Valley area. The world MAP tab remains unchanged and continues to show actual roads and current location.

**Regression acceptance**
- Tap PLAY and see SELECT REGION, **not** an Apple map.
- California → Peninsula Coast → choose Half Moon Bay Coast or Pescadero Coastal Run.
- California → Monterey Peninsula → select 17-Mile Drive under CRUISES.
- California → Silicon Valley → see Ridge RUN or NVIDIA POC TEST; choose OPEN DEVELOPMENT CONQUEST MAP only as a separate action.
- Navigate back from Conquests to Area and from Area to Region.
- MAP tab remains the geographic map, independent of PLAY selection.
- No selection, cruise or map preview can award territory ownership or CLOUT.

The prior hidden toolbar was insufficient for route discovery; PLAY now uses a full-screen selector. The old map is retained under `/conquests/dev-map` only. No production capture or database writes are enabled.
