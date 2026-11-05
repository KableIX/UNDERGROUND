# Districts

| Slug | Kind | Role |
|------|------|------|
| `silicon-valley-dev` | **development** | Santa Clara / NVIDIA-area test routes — never production-capturable |
| `monterey` | **production_candidate** | Second production candidate; geometries remain **draft** |

## Silicon Valley / Santa Clara (development)

Fixtures: `tests/fixtures/silicon-valley-dev-territories.ts`  
SQL: `supabase/seed/silicon_valley_dev_territories.sql`  
Landmarks: `apps/mobile/src/data/landmarks.ts` (public campus/venue centroids only)

| Slug | Name | Notes |
|------|------|-------|
| `santa-clara-el-camino` | El Camino — Santa Clara | UNVERIFIED draft corridor |
| `santa-clara-central-expressway` | Central Expressway — NVIDIA corridor | Passes near NVIDIA campus landmark |
| `santa-clara-lawrence-loop` | Lawrence Expressway loop | UNVERIFIED draft corridor |
| `san-tomas-expressway` | San Tomas Expressway | UNVERIFIED draft corridor |

Geometry label: `UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED` — **do not claim GPS accuracy**. Replace with Mapbox Directions / operator-reviewed centerlines before `approved`.

Conquest map defaults to **SV DEV**. UI + engine hard-block production capture. Sim → Newswire only; CLOUT +0; ownership write false.

## Monterey (production candidate)

Draft placeholder LineStrings — see `docs/MONTEREY_DRAFT_TERRITORIES.md`. Production captures disabled while `status=draft`.

## Gates

- `allowsProductionOwnership('development') === false`
- Monterey draft `status=draft` rejects production captures until geometries are reviewed
- Simulation evidence never writes production ownership
- No public-road speed rewards
