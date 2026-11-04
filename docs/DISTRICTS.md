# Districts

| Slug | Kind | Role |
|------|------|------|
| `silicon-valley-dev` | **development** | Santa Clara test routes — never production-capturable |
| `monterey` | **production_candidate** | Second production candidate; geometries remain **draft** |

Development district gate: `allowsProductionOwnership('development') === false` and `applyCaptureForDistrict` returns `development_district`.
