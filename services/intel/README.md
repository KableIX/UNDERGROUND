# UNDERGROUND INTEL shadow collector
Official sources only: Caltrans CWWP2 Lane Closure System D4/D5, NWS active alerts CA/FL, and 511 SF Bay Open511 traffic events (`https://api.511.org/traffic/events?format=json&status=ACTIVE&limit=500`; originators CHP, Caltrans, local agencies). No app publication (`PUBLISH=False`, `incidents.published` is CHECK-constrained to 0), no patrol tracking, no radio, no Waze, no GPU. Five minute cadence. Never interpret missing data as clear roads.

## 511 credential
Read at runtime from `~/.config/underground-intel/511.token` (dir 700, file 600; the collector refuses a group/world-readable file). Never committed, never logged: the 511 API echoes the key in `meta.url`/`pagination.next_url`, so responses are scrubbed before storage, stored URLs are key-free, and a logging filter redacts `api_key=` and the literal token. Missing token -> 511 health `BLOCKED`, other sources continue.

## Limits
511 allows 60 requests/3600 s per key. INTEL makes 1 call per 5-min cycle (12/h), self-caps at 30/h via `request_log` (retries counted), and pauses if the provider's `RateLimit-Remaining` drops below 5. Requests: 25 s timeout, 3 attempts with 2 s/4 s backoff on network/5xx errors, no retry on 4xx/429.

## Tables (shadow.sqlite3)
- `snapshots` / `health`: raw latest payload per source + simple health (unchanged, back-compatible).
- `incidents`: normalized 511 events and Caltrans LCS closures. Coordinates (`lat/lon`, LCS end point, raw geometry), `geo_valid` (California bounds), `starts_at/ends_at/created_at/updated_at`, `expires_at` + `expiry_basis` (provider schedule, else rolling 15 min after last seen), `attribution`, `upstream` originator, `verification_status='unverified_official'`, `published=0`, `active`/`withdrawn_at` (inactive records retained for 14 days after last sighting), `duplicate_of`, `raw`.
- `duplicate_links`: 511 event <-> Caltrans LCS record when same normalized road (CA-x == SR-x), 511 point within 1 km of the LCS begin-end segment, overlapping time, LCS not lifted (1098). Both raw records are kept.
- `source_health`: state (OK/FAILED/BLOCKED/RATE_LIMITED_SELF), last success, consecutive failures, latency, provider rate remaining.
- `ingest_stats`: per-cycle per-source counts (records, normalized, inserted, updated, expired, duplicates, by_category).
- `request_log`: 511 request budget.

## Tests
`python3 -m unittest discover -s tests -v` (offline; uses `tests/fixture_511_events.json`, a real 511 response with the key removed).

## Next
Geospatial route correlation, coverage gates, reviewed publication, Florida traffic (FL511), more Caltrans districts, admin/member flow, RSVP notices.

## Retention and expiry
Ended/lifted records stay inactive even if the feed repeats them; only active-to-inactive transitions count as expirations. Inactive raw payloads are cleared after 7 days; unseen inactive records, duplicate links and ingestion stats are removed after 14 days. Latest snapshots expire after 24 hours without refresh, and request logs after 24 hours. SQLite reuses freed pages; file size does not immediately shrink. Shadow publication stays disabled.

## Route assessment
Normalized active Caltrans and approved 511 road-hazard events are correlated in shadow mode. Only current NWS polygons intersecting route geometry can appear in the existing limited preview API. Road matches are not proof of road identity or direction, and must never be published as verified closures. Health and timestamps are checked at assessment and read time; partial or stale data is UNKNOWN. No individual enforcement tracking.
