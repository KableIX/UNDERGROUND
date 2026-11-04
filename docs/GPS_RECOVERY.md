# Background GPS recovery

## Status honesty

| Capability | Status |
|------------|--------|
| Pure GPS buffer merge + timestamp dedupe | **Implemented** (`packages/territory-engine` `mergeGpsBuffers`) |
| Gap detection helper | **Implemented** (`findGpsGaps`) |
| iOS background location resume after process death | **Planned** — needs native/dev-client + credentials |
| Server checkpoint watermark sync | **Planned** — needs Supabase/API persistence |
| Auto-flag EVIDENCE_REVIEW on large gaps | **Planned** — policy not wired to run transitions yet |

See `GPS_RECOVERY_STATUS` exported from `@underground/territory-engine` and unit tests in `packages/territory-engine/tests/gps-recovery.test.ts`.

## Non-claims

- No live background GPS recovery on device has been verified.
- Sim GPS fixtures in `tests/fixtures/sim-evidence.ts` are test-only.
