# Monterey District — draft territories

All seeded routes are **draft** placeholder LineStrings. They are not reviewed road-following geometries and must not accept production captures.

| Slug | Name | Weight |
|------|------|--------|
| `highway-1-big-sur` | Highway 1 / Big Sur | 20 |
| `carmel-valley-road` | Carmel Valley Road | 14 |
| `laureles-grade` | Laureles Grade | 12 |
| `seventeen-mile-drive` | 17-Mile Drive | 16 |
| `pacific-grove` | Pacific Grove | 10 |
| `cannery-row` | Cannery Row | 8 |
| `laguna-seca-area` | Laguna Seca Area | 20 |

## Sources

- TypeScript fixtures: `tests/fixtures/monterey-draft-territories.ts`
- SQL seed: `supabase/seed/monterey_draft_territories.sql`
- Map UI: Conquest tab dark fallback (Mapbox when token present)

## Engine gates

- `status=draft` → capture rejected (`draft_territory`)
- `evidenceSource=simulation` → production ownership write blocked
- District crown only when an owner holds **>50%** eligible weight on a track; solo and club independent
