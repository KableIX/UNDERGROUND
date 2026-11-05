# UNDERGROUND — Competitive Analysis

**Date:** 2026-11-05  
**Scope:** Public product pages, App Store / Play listings, and vendor marketing only.  
**Method:** Confirmed = stated on a public page cited below. Inferred = reasonable product implication, marked as such.  
**Hard rule:** No proprietary UI layouts, code, assets, route geometries, or branding copied into UNDERGROUND.

---

## Positioning frame

UNDERGROUND is an **invitation-only** iOS social network + **server-authoritative road-territory conquest** game for **verified supercar owners**. Competitors below cover pieces of driving social, scenic routing, or territory play — none publicly match the full gated verification + majority-crown conquest loop.

| Axis | UNDERGROUND stance |
|------|--------------------|
| Access | Invitation + vehicle verification |
| Scoring | Territory ownership / defense / clout — **not** public-road speed or race time |
| Maps | Dark tactical / satellite; curated territories with draft→approved gates |
| Authority | Server adjudications; sim evidence never writes production ownership |
| Social | Garage, friends/Top8, clubs, Newswire — friend-gated by default |

---

## 1. Enroad

**Sources (confirmed):** [enroad.app](https://enroad.app/), [FAQ](https://enroad.app/faq), [What Enroad Is](https://enroad.app/what-is-enroad), [Pricing](https://enroad.app/pricing), Google Play listing.

### Confirmed

- Automatic background drive detection; optional manual start; “never press start” positioning.
- Trip history with route maps; elevation / climbs / braking / turns / lane changes / stops (Pro).
- Satellite 3D “Ride Replay” chase-camera playback (Pro).
- Shareable end-of-drive cards / monthly recap cards.
- Leaderboards by **area held**, all-time distance, longest drive, trophies — friends free; city/country/worldwide with Pro.
- Shared **hexagon territory grid** (~262 m cells): drive through hexes to claim / steal; single-player + club turf (Pro).
- Clubs; friends via QR/code.
- Privacy framing: device-first trips; optional keep-on-device; territory claimed via cell IDs (marketing claims GPS not sent for territory); hide-from-leaderboards.
- Explicit anti-performance stance: no performance boards; obey speed limits messaging.
- Freemium Pro (~$9.99/mo or yearly).

### Inferred

- Mass-market, not invitation-only vehicle verification.
- Hex ownership is volume-of-driving based rather than curated scenic territory conquest with evidence review.
- Android + iOS consumer app (not premium gated garage culture).

### UNDERGROUND differentiation

- Curated road territories + verified capture evidence vs automatic hex carpet.
- Invitation + ownership gate vs open download.
- No hex-grid UI language; avoid bright hexagon carpets (product design non-negotiable).
- Align with Enroad on **no public-road speed competition** (confirmed overlap of values).

---

## 2. ROADS by Porsche

**Sources (confirmed):** [Porsche Stories](https://www.porsche.com/stories/innovation/what-is-porsche-roads/), [roads.porsche.com](https://roads.porsche.com/en), [App Store](https://apps.apple.com/us/app/roads-by-porsche-route-planner/id1438225964), [Newsroom 2020](https://newsroom.porsche.com/en/2020/digital/porsche-roads-app-new-functions-21941.html), Porsche Club News features.

### Confirmed

- Free scenic route planner / community for drivers (not Porsche-owners-only).
- Route generator using road characteristics (curves, speed, elevation, local conditions) between waypoints or timed roundtrips.
- In-app GPS navigation; 3D route preview; multi-stage tours; Google Maps import; **GPX export**.
- Community groups (public/private); follow; feed of trips/photos; group “Ausfahrten” / joint trips.
- POI discovery; air-quality along route (historical Newsroom feature).
- Brand-backed catalog of community-shared scenic routes.

### Inferred

- OEM marketing + lifestyle community first; not a competitive territory ownership game.
- Routing intelligence is proprietary; UNDERGROUND must not reverse-engineer or copy geometries — only adopt **contracts** (road-following, GPX I/O, multi-stage).

### UNDERGROUND differentiation

- Conquest + verification loop is out of ROADS’ public scope.
- Learn **route-planning UX contracts**: scenic preference, multi-stage rally, GPX export, share ACL — implement with our own engine/providers, never copy ROADS route catalog or UI chrome.

---

## 3. RoadStr

**Sources (confirmed):** [roadstr.io tutorials](https://www.roadstr.io/tutorials-for-new-members-welcome-to-roadstr/), [Play Store](https://play.google.com/store/apps/details?id=io.roadstr.app), [App Store](https://apps.apple.com/rs/app/roadstr-car-routes-events/id1382535778), older RoadStr product pages.

### Confirmed

- Social network for car enthusiasts: feed, profiles, garages, likes/comments.
- Map of user routes, POIs, events, businesses; offline maps.
- Events (meets, track days, drives) with attendance, event chat, share.
- Private club “Rooms”; group chats; 1:1 chats.
- **RoadSharing** live location on map for group drives.
- **CarPlay** compatible (App Store claim).
- Broad, open enthusiast market (not verified-ownership gated).

### Inferred

- Event/club ops are a primary retention loop vs territory crowns.
- Live location sharing implies significant privacy UX — UNDERGROUND should keep location opt-in and run-scoped.

### UNDERGROUND differentiation

- Verified ownership + conquest scoring vs open social + events.
- Borrow **patterns** only: clubhouses/events, DMs, guestbooks, offline maps, CarPlay **architecture** (no entitlement assumption until Apple grants).

---

## 4. Carve

**Sources (confirmed):** [carve.run](https://carve.run/), [group drives](https://carve.run/group-drives/), [drives catalog](https://carve.run/drives/), [support](https://carve.run/support/), planning guides.

### Confirmed

- Scenic drive planner + navigation; **follows chosen roads** (does not swap for fastest).
- 1,200+ hand-picked drives with twistiness labels (Leisurely / Sweeping / Twisty / Intense).
- Plan stop-by-stop; import Google Maps / GPX / Ride with GPS; share link/QR.
- Spoken turn-by-turn; offline download (Apex); group live positions on map / CarPlay / Android Auto (Apex).
- Wrong-turn rejoin-forward; hazard reports to drivers behind.
- Freemium Apex subscription.

### Inferred

- Club-run tooling is the core job-to-be-done; territory conquest is absent.
- Road-following guarantee is a **must-have contract** for UNDERGROUND route planning (confirmed industry expectation).

### UNDERGROUND differentiation

- Conquest territories are gameplay objects with evidence/crown rules, not only navigable scenic guides.
- Adopt road-following + GPX + offline TBT **architecture** without copying Carve route catalog or map styling.

---

## 5. RoadTribe

**Sources (confirmed):** LinkedIn company/about ([RoadTribe](https://linkedin.com/company/roadtribe)), founder posts; note naming collision with **roadtribe.app** (UK rider POI map — different product).

### Confirmed (automotive RoadTribe / roadtribe.io)

- Self-described “Strava for automotive enthusiasts.”
- GPS trip record/pause/save; offline-capable recording with later sync.
- Vehicle garage (cars/bikes); trip visibility controls; social feed with likes/comments/friend tags.
- Premium live convoy tracking.
- Early-stage (founded ~2025 per LinkedIn; launch/beta messaging).

### Inferred

- Lightweight social trip log; not curated territory conquest or invitation verification.
- Convoy tracking overlaps RoadStr/Carve group patterns.

### UNDERGROUND differentiation

- Heavier verification, districts, majority crowns, CLOUT ledgers, draft geometry gates.
- Similar garage + trip privacy needs — implement with UNDERGROUND RLS, not RoadTribe UX copy.

### Naming caution

- **roadtribe.app** markets rider cafés/campsites POIs — treat as a separate entity; do not conflate features.

---

## Feature matrix (confirmed public claims only)

| Capability | Enroad | ROADS | RoadStr | Carve | RoadTribe | UNDERGROUND target |
|------------|--------|-------|---------|-------|-----------|--------------------|
| Auto trip track | ✓ | record/share | — | record (Apex) | ✓ | Verified run pipeline (manual/gated) |
| Scenic route gen | — | ✓ | user routes | ✓ catalog+plan | — | Road-following planner (own) |
| GPX / import-export | — | GPX out / GMaps in | — | GPX/GMaps/RwGPS | — | GPX I/O contracts |
| Live group / convoy | — | group trips | RoadSharing | Group (Apex) | Premium convoy | Opt-in, run-scoped (later) |
| Territory play | Hex grid | — | — | — | — | Curated roads + crowns |
| Clubs | ✓ | groups | Rooms | share to club | — | Clubs + club crowns |
| Garage | AI mods (Pro) | — | ✓ | — | ✓ | Verified friend-gated garage |
| CarPlay | — | — | ✓ listed | Apex | — | Architecture only until entitlement |
| Invitation / ownership gate | — | — | — | — | — | **Core** |
| No speed scoring | ✓ stated | n/a | n/a | n/a | n/a | **Non-negotiable** |

---

## Implications for Phase 1 build (actionable, non-copying)

1. **Territory:** Prefer curated LineString territories + evidence over hex carpet (anti-Enroad-visual; anti-copy).
2. **Routing:** Implement scenic/technical class, multi-stage, GPX, road-following **contracts** inspired by ROADS/Carve public promises — geometries must be operator-reviewed or DRAFT.
3. **Social:** Friends, DMs, events/clubhouses, guestbooks, opt-in regional discovery — RoadStr-shaped jobs, UNDERGROUND authz.
4. **Safety/privacy:** Align with Enroad/Carve public safety messaging; background GPS only during active runs; directory opt-in.
5. **Monetization:** Do not ship real-money gameplay; CLOUT / garage credits are soft ledgers only.
6. **CarPlay / Mapbox / push:** Document entitlement and secret needs; do not assume Apple approval.

---

## Evidence hygiene

| Label | Meaning |
|-------|---------|
| **Confirmed** | Quoted or paraphrased from a cited public page on the research date |
| **Inferred** | Product implication not explicitly marketed; may be wrong |

Re-verify App Store copy before any marketing claims about competitors. Never ingest competitor route files, hex definitions, or app binaries into this repo.
