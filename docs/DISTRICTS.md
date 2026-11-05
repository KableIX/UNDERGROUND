# Districts

| Slug | Kind | Role |
|------|------|------|
| `silicon-valley-dev` | **development** | Santa Clara test routes — never production-capturable |
| `monterey` | **production_candidate** | Second production candidate; geometries remain **draft** |

## Silicon Valley / Santa Clara (development)

Fixtures: `tests/fixtures/silicon-valley-dev-territories.ts`  
SQL: `supabase/seed/silicon_valley_dev_territories.sql`

| Slug | Name |
|------|------|
| `santa-clara-el-camino` | Santa Clara El Camino Test |
| `santa-clara-central-expressway` | Santa Clara Central Expressway Test |
| `santa-clara-lawrence-loop` | Lawrence Expressway Loop Test |

Conquest map defaults to **SV DEV** with an explicit UI hard-block on production capture actions. Engine `applyCaptureForDistrict` also returns `development_district`.

## Gates

- `allowsProductionOwnership('development') === false`
- Monterey draft `status=draft` still rejects production captures until geometries are reviewed
- Simulation evidence never writes production ownership
