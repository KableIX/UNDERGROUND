# NVIDIA route work

Owner/release owner: TJ; implementation: Codex.
Workspace: UNDERGROUND-play-simple; branch fix/play-single-screen; input commit 8e7dbc8.
Objective: selecting NVIDIA opens its mapped campus loop, frames route and labels start/finish. Preserve approved photo and discovery flow.
Authorization: user request to finish this run, 2026-11-05 America/Los_Angeles.
Scope: route preview and selection. GPS claiming remains separate and unverified.

## Append-only ledger

- NVIDIA-01, 2026-11-05 America/Los_Angeles: Planned route data acquisition and preview integration. Inspection observed card links to text-only details; no campus-loop geometry; Apple fallback omits finish marker. Proposed: use licensed OSM road graph, preserve street order; implement focused preview and labeled endpoints. Live device acceptance pending.
- NVIDIA-01a: Overpass DE POST observed HTTP 406; no geometry acquired from that attempt. Retrying alternate public endpoint with GET. No source changes yet.

- NVIDIA-01b, 2026-11-05 18:18 America/Los_Angeles: OSM main map API download succeeded after Overpass endpoints returned 406/timeouts. Built a 4,112 m closed preview from 153 actual road vertices across 41 OSM ways, respecting tagged one-way direction and street order. Preview start/finish proposed at Scott Boulevard / Bowers Avenue. Source URL, retrieval timestamp, SHA-256 and ODbL attribution stored in route JSON. Not a validation of turn restrictions, closures, clearance or GPS capture gates.
- NVIDIA-02: Implemented direct NVIDIA card -> dedicated route map, full-route bounds fitting, FIT action, persistent Apple MapKit endpoint labels and Mapbox endpoint labels (single START / FINISH for closed loops). Existing NVIDIA photo retained as thumbnail; full details linked. Unrelated existing worktree changes preserved.
- NVIDIA-03: Observed checks: mobile TypeScript exit 0; focused ESLint exit 0; current tunnel served iOS bundle HTTP 200, 13,050,947 bytes. Source compiler is Metro on Aphrodite, preview port 8084. No iPhone tap-through or screenshot observed; native display remains pending user acceptance.

## Current status
Milestone: route-preview implementation complete, served in active development bundle. No production capture enabled.
Current writer: Codex. Release owner: TJ.
Next acceptance: reload UNDERGROUND, Play -> Silicon Valley -> POC -> NVIDIA; confirm full loop, readable START / FINISH and FIT after panning. Verify physical GPS gates separately.
Recovery: revert this focused commit; approved catalog photos and unrelated local changes remain separate.

- NVIDIA-04: Git commit attempt observed failure: no configured author identity. No global/local identity changed. Implementation remains staged and served by Metro; input commit remains 8e7dbc8. Recovery is the focused staged diff rather than a new commit. This corrects the prospective commit recovery reference above.

- NVIDIA-05, 2026-11-05 America/Los_Angeles: User screenshot IMG_2057 shows generic /conquests/dev-map (El Camino selected), not dedicated NVIDIA screen. Root cause: secondary NVIDIA DEVELOPMENT MAP link still pointed to the generic map. Planned and implemented: point secondary entry at /runs/nvidia-map; replace legacy /conquests/dev-map screen with direct re-export of dedicated NVIDIA map so existing open/restored navigation also receives the correction. No changes to route geometry. User screenshot is evidence of prior navigation failure, not acceptance of new map.
- NVIDIA-05 verification: mobile TypeScript and focused ESLint observed exit 0. Active public tunnel served updated iOS bundle HTTP 200, 13,048,890 bytes. Both NVIDIA navigation entries now resolve to dedicated loop screen; legacy screen directly reuses it. On-device rendering after this correction is not yet observed.

- NVIDIA-06, 2026-11-05 America/Los_Angeles: User confirmed on-phone route shape is correct (IMG_2062) and requested populated NVIDIA imagery, NFS-like route emphasis and start/tracking flow. Implemented NVIDIA photo card in Silicon Valley RUN view (TEST card retained); layered neon green/white route strokes, dark Apple basemap with POIs suppressed, hidden diagnostic banners in focused route mode and no duplicate native start callout. Dedicated map now uses existing persistent foreground recorder with Start/Pause/Resume/End & Save, live location, GPS quality, recorded distance/duration/sample count and pause-on-leave confirmation. Trip history accessible after ending. These are local private recording controls, not automatic route completion/ownership validation. Screen explicitly explains foreground-only recording and incomplete route verification. TypeScript and focused ESLint observed exit 0. Pending engine regression and bundle checks; on-phone visual acceptance of new styling not observed.
- NVIDIA-06 checks: initial test command failed before execution because package-local vitest shim was absent. Retried using workspace-root executable from drive-tracking package: 17/17 tests passed across 4 files (GPS discontinuities, lifecycle, persistence, replay). Updated public tunnel iOS bundle returned HTTP 200, 13,058,821 bytes. This verifies bundle compilation and existing engine regressions, not live iPhone GPS or SQLite persistence. No automatic finish detection or server claim enabled.

- NVIDIA-07, 2026-11-05 20:26 America/Los_Angeles: IMG_2065 confirms missing ExpoSQLite error in isExpoSqliteNativeAvailable -> require(expo-sqlite). Replaced import-based probe with expo-modules-core requireOptionalNativeModule('ExpoSQLite'), avoiding the throwing package initializer entirely on incompatible IPAs. Native registry implementation checked in installed source. Added three regression cases: absent, present, registry failure; combined probe/store tests 7/7 pass; TypeScript exit 0. NVIDIA screen now explicitly discloses temporary memory storage and labels END RUN instead of END & SAVE when SQLite is missing. Correction to NVIDIA-06: device evidence confirms this installed IPA cannot durably save through SQLite; permanent saving needs a native build containing ExpoSQLite. No on-phone post-fix verification yet.

- NVIDIA-08, 2026-11-06 America/Los_Angeles: User reports nonfunctional capture and requests a separate in-run metrics screen. Inspection confirms onProdChallenge only displayed a hard-coded blocked message. Added full-screen ActiveRunDashboard, automatically presented after recording starts/resumes, retaining the same recorder instance. Displays fresh GPS speed in mph, active duration, distance, average speed, sample count, accuracy, paused/ended states and controls. No trustworthy current speed is shown with stale/poor/discontinuous GPS. G-force explicitly unavailable: expo-sensors is absent from dependency/build; no fabricated value. Dashboard is recording status, not proof of ordered route completion. Replaced misleading CAPTURE TERRITORY action with CHOOSE A RUN and working catalog navigation. Actual authoritative capture still unimplemented; do not report this as capture fixed. Native build/storage and route adjudication remain handoff work. Temporary storage/foreground limitations retained.
- NVIDIA-08 verification: mobile TypeScript and focused ESLint exit 0; updated public-tunnel iOS bundle HTTP 200, 13,072,407 bytes. On-device dashboard and live speed not observed. No server capture exercised or awarded.


## 2026-11-07 dashboard typography correction and concept exploration
User screenshot shows clipped heading and absent speed glyph. Confirmed shared Text defaults to body lineHeight 22 even when callers override fontSize. Scoped fix in ActiveRunDashboard supplies title lineHeight 44, speed 132, metric values 32. No telemetry or capture behavior changes. Generated separate visual concepts for review; designs are not implemented and contain sample data. Physical iPhone rendering remains to be verified.

## 2026-11-06 Pacific | Active-run brand header
Added a header above the route row in ActiveRunDashboard. Artwork uses the exact bundled white/red tach emblem and outlines from BarlowCondensed_700Bold.ttf with a silver gradient. Source SVG and transparent PNG are in apps/mobile/assets/brand/underground-lockup-silver.*. Mobile typecheck and focused lint passed. Local iOS Metro bundle returned HTTP 200 (13,073,718 bytes). Header asset preview inspected; physical iPhone rendering is unverified.
