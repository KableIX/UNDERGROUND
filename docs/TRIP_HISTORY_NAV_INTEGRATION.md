# Trip History — navigation integration point

## Standalone route (shipped)

Expo Router stack at `/trips`:

| Path | Screen |
|------|--------|
| `/trips` | Trip History list (offline) |
| `/trips/record` | Foreground record / pause / resume / end |
| `/trips/[id]` | Detail + route replay |

Root stack registration: `apps/mobile/app/_layout.tsx` → `<Stack.Screen name="trips" />`.

## Deliberately not wired yet

Active Conquest / map UI is **unchanged** in this milestone:

- `ConquestMap.tsx`
- `MapboxTerritoryMap.tsx`
- `WorldMapFallback.tsx`
- Tab bar (`app/(tabs)/_layout.tsx`)

Drive mode on the map still uses the volatile `useForegroundDrive` hook. Persistent recording lives under `/trips/record`.

## Suggested future entry points (do not implement without product sign-off)

1. **Profile** — add a “Trip History” row that `router.push('/trips')`.
2. **Garage** — “Drives” section linking the selected vehicle’s local trips.
3. **Conquest command sheet** — secondary “History” action that leaves the map route, without embedding history chrome on the map.

## Deep link

Scheme: `underground://trips` (via Expo Router `scheme: underground`).
