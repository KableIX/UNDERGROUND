---
cursor:
  subagentId: "bc-4e45e7f3-5684-51b3-a5b6-1a89c5a43a98"
---

# Conquest v2 — Mapbox tactical map

**Repo:** KableIX/UNDERGROUND only (not sakura-harness)  
**Worktree:** `/home/ubuntu/UNDERGROUND-conquest-v2`  
**Branch:** `feature/conquest-v2-mapbox`  
**PR:** https://github.com/KableIX/UNDERGROUND/pull/2 → base `cursor/phase1-foundation-8c89` (**not main, not merged**)  
**HEAD SHA:** `e586b02`  
**Aphrodite local WIP:** not touched / not auto-merged

## EAS build (this turn)

| Field | Value |
|-------|-------|
| Profile | `development` |
| Platform | iOS |
| Team | `2TZCY23DP9` (existing creds; no re-enrollment) |
| Bundle | `vip.theunderground.app` |
| Build URL | https://expo.dev/accounts/undergroundvps-team/projects/underground/builds/720d6253-09e9-48b2-9e17-0adc8e397038 |
| Device verification | **Not claimed** — awaiting TJ install confirmation of this new build |

## Native dependency changes

| Package | Version | Purpose |
|---------|---------|---------|
| `@rnmapbox/maps` | `10.1.39` | Native Mapbox Maps (Expo 52 / RN 0.76 peer range; **device MapView unverified until install**) |
| `expo-image-picker` | `~16.0.6` | Garage photo picker with placeholder fallback |

Config: `apps/mobile/app.config.ts` — Mapbox **config plugin links only when** `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` is set in the build env. Without it, JS + tactical fallback ship (avoids CocoaPods failure). `expo-image-picker` plugin always linked.

## Env vars (never committed)

| Var | Role |
|-----|------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Public runtime `pk.*` for MapView / Static |
| `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` | Private `sk.*` download for native SDK at build |
| `EXPO_TOKEN` / `expo_token` | EAS CLI auth (agent env; not committed) |

**EAS project env (development/preview/production):** empty at build time — no Mapbox secrets stored yet. Add both tokens to EAS and rebuild to enable native MapView binary.

## iOS rebuild requirements

1. New **custom development client** required for native Mapbox (Expo Go unsupported).
2. This turn’s EAS build produces a new internal IPA for the registered device.
3. To enable native MapView (not just fallback): set `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` + `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` on EAS → rebuild.
4. Do **not** claim Mapbox satellite on-device until TJ confirms install of a build that linked the plugin with download token.

## ADRs

- `docs/ADR-008-MAPBOX-NATIVE.md` — native Mapbox decision + token separation + plugin gating

## Tests / gates (this turn)

```
pnpm test       → green (domain 44 + persistence 7 + territory-engine 32 + mobile 16 + api 18)
pnpm typecheck  → exit 0
pnpm lint       → exit 0
npx expo-doctor → 18/18
npx expo export --platform ios → success
```

Coverage added: GeoJSON/selection, Mapbox token/availability fallback, sim/district integrity gates.

## Product surface

- Map-first Conquest tab + collapsible bottom sheet (name, ownership, solo/club, challenge, sim)
- SV DEV default — NVIDIA-area landmark camera; draft corridors labeled `UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED` (no accuracy claim)
- Monterey = production_candidate DRAFT; production captures disabled
- Sim → Newswire only; ownership write false; CLOUT +0

## Implemented vs mocked vs device-verified

| Item | Status |
|------|--------|
| Mapbox JS integration + fallback | **Implemented** |
| Native MapView in this IPA | **Not linked** (download token absent in EAS) |
| Tactical fallback plane | **Implemented** |
| District/sim integrity gates | **Implemented** + tested |
| Signed device Mapbox UX | **Unverified** — needs TJ install + ideally tokened rebuild |
| Production captures | **Disabled** |

## Blockers needing TJ / secrets (not Apple enrollment)

1. Add EAS secrets: `RNMAPBOX_MAPS_DOWNLOAD_TOKEN`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
2. Rebuild development profile to link native Mapbox plugin
3. Confirm install of build `720d6253-09e9-48b2-9e17-0adc8e397038` (or successor)
4. Optional: operator-reviewed road-snapped geometries to replace unverified draft corridors

## Key commits

| SHA | Message |
|-----|---------|
| `94a82f6` | Competitive analysis (cherry-picked onto tip with Apple Team commit) |
| `0450731` | feat(conquest): Mapbox v2 tactical map with fallback sheet |
| `c38d2e3` | chore: carry persistence/social domain WIP |
| `e586b02` | fix(mobile): link Mapbox native plugin only with download token |
