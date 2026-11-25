# UNDERGROUND Club Radar

Implemented on `feature/radar-club-alerts`, based on the newest available GitHub source, `feature/grok-newswire-connector` at `30cd6a1`. This is **not a deployment to the current beta**. Aphrodite was offline during implementation, and its beta has newer unpublished changes (including Jacob’s Pass). Integrate this commit into that worktree after reviewing its changes; do not replace the beta with this older base or merge the app into the placeholder `main` branch blindly.

## Member experience

The map has a **RADAR** entry leading to `/radar`. Start a foreground radar session, then either connect an R8/R8w or submit manual observations with any detector, including the R7.

- R8/R8w scanning, selection, GATT capability checks, initial state read, and live notifications. No detector settings or firmware writes.
- Local band, strength, relative direction and frequency where the protocol supplies it.
- Explicit missing-module, permission, disconnected, stale-feed, and unknown-packet states. An unknown packet never becomes “no alerts.”
- Choose one of the signed-in member’s actual clubs to receive its report feed. Local-only is the default. Automatic detector sharing is a separate opt-in, off at every new session and club switch.
- Only unmuted, fully decoded observations with a healthy heartbeat and a phone GPS fix no older than 15 seconds and within 100 m accuracy are automatically shared.
- At most one automatic upload per 30 seconds, with a 5-minute per-signal cooldown. Unknown mute codes do not pass the automatic sharing gate. Signal correlation is approximate; no unique transmitter identity is available.
- Reports carry the observer’s phone position, **not the radar source’s position**. No speed, BLE device ID, full route history or saved detector POIs are uploaded.
- Nearby reports within 5 km appear on the main Mapbox map and Apple MapKit fallback. Tap a pin or the RADAR entry for details and “still present” / “gone” feedback. Amber is radar detection; purple is a member-reported police sighting.
- Club feed polls every 5 seconds; failures clear the cached reports and display unavailable. This is not a latency-guaranteed or background alert service.
- Backgrounding the app, signing out, changing accounts or ending the session disconnects Bluetooth, removes the radar GPS watch, clears observations and turns sharing off. Returning to the foreground requires a new session. Temporary iOS `inactive` states from permission prompts do not destroy setup.

## Backend

Apply `supabase/migrations/20261124000011_club_radar.sql` to the beta database only after reconciling its migration history. It adds reports, confirmations, RLS and narrowly scoped RPCs using the existing `current_member_id()` and `club_memberships` tables.

`submit_club_radar` derives the reporter from Supabase auth; clients cannot choose authors, timestamps, TTLs or confirmation counts. Both submission and reads require membership in the selected club. Reports cease being visible when either the reader or author loses club membership. Direct client inserts/updates/deletes are denied. An advisory transaction lock serializes a member’s uploads to enforce the server’s 10-second rate limit across clubs; event IDs make retries idempotent.

Radar expires after 5 minutes; manual sightings expire after 10. Expiry is enforced at read time by RLS and again in the client. Confirmations require another member of the same club and an unexpired report. Each member has one vote, which they may change. Votes neither extend expiry nor turn machine detections into verified police sightings. Detector identity and client coordinates are not cryptographically attested; all shared entries are observations, not trusted enforcement evidence. Nothing enters conquest, scoring or ranking paths.

For physical removal of expired coordinates, enable a backend purge schedule. With Supabase Cron enabled, run once as an operator:

```sql
select cron.schedule(
  'purge-expired-club-radar',
  '*/5 * * * *',
  'select public.purge_expired_club_radar();'
);
```

The migration provides the purge function and restricts it to `service_role`/the owner; it does not assume `pg_cron` is installed. No production schedule or migration was applied during this task. Without a purge schedule, expired rows remain stored but are hidden from members by RLS.

Existing mobile authentication configuration is reused: Supabase URL/anon key and member API URL. Fixture login and dev bypass do not authorize club publishing. A configured, verified member login and actual club memberships are required for the shared feed.

## Native integration and release

`react-native-ble-plx@3.5.0` is pinned and its Expo config plugin declares the Bluetooth permission without adding Bluetooth background modes. The existing location background setting belongs to the previous app configuration; radar itself stops on background.

This requires a **new EAS development binary**. An OTA/Metro refresh cannot add the native BLE module. Older binaries continue loading the app and show a new-build message if a detector connection is attempted. Web has no direct detector connection.

From the reconciled beta checkout:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
cd apps/mobile
npx expo export --platform ios --output-dir /tmp/underground-radar-ios
npx eas-cli build --platform ios --profile development
```

Install the development binary on a physical phone; on the detector select **MENU → BT Pairing → MENU**, and disconnect R/TACH or other detector clients before scanning in UNDERGROUND. No firmware change is performed by this feature.

Before release, verify actual packet reception and direction/strength against the detector display on **each model/firmware**, first-run permissions, denied permissions, power loss, reconnect, background/resume, sign-out, missing native modules, two phones in the same club, a phone in a different club, club removal, GPS denied/stale/inaccurate, network loss, TTL expiry and purge. Verify the current beta’s map layout on iPhone after integrating. Native UI rendering and physical Bluetooth behavior have not been validated in this Linux environment.

## Protocol evidence

The receive-only implementation uses these community references, reviewed November 24, 2026:

- [AegisX86 R8w protocol](https://github.com/AegisX86/UnidenR8wlink/blob/main/PROTOCOL.md): data-service UUID, alert and telemetry characteristic UUIDs, ASCII snapshots and published samples.
- [JeremyWhittaker R8 protocol](https://github.com/JeremyWhittaker/unidenr8_bluetooth/blob/main/docs/PROTOCOL.md): evidence qualifications, eight-field sample versus optional ninth field, unknown mute handling, and absence of a live latitude/longitude feed.
- [Uniden R/TACH model list](https://uniden.com/pages/rtach-app): official app-capable models. This is not an official UNDERGROUND SDK or certification.
- [BLE PLX documentation](https://dotintent.github.io/react-native-ble-plx/): native connection, discovery and monitoring lifecycle.

Supported decoder shape is a four-slot `&`-separated snapshot. A nonempty slot must have eight or nine comma fields, a recognized band, strength 1–8 and direction F/S/R. Unknown shapes are surfaced, not guessed. Only microwave bands interpret field 5 as GHz; LASER identifiers are never shown as frequencies. Test fixtures are published examples, not captures from the user’s hardware. The parser’s success does not certify all firmware variants.

## R7 bridge investigation

[Nathan2005’s R7 firmware announcement](https://www.rdforum.org/threads/155414/) reports a custom firmware UART path and an ESP32 Bluetooth bridge with companion-app alert mirroring. The author’s indexed post describes an ESP32 around £7; this is a component estimate, not a complete supported accessory or validated bill of materials.

The stock R7 has no built-in Bluetooth. Its official USB update interface is not treated as a live alert feed here. No generic BLE dongle can be assumed to solve this. The announcement’s firmware, bridge source, transport framing, electrical connection and recovery procedure have not been independently validated. No R7 flashing, wiring changes or bridge protocol have been invented or enabled.

Next prototype steps: obtain the author’s exact release/source and license; confirm support for the user’s R7 hardware and firmware; review UART electrical requirements and recovery; capture alert packets on a bench; implement a separate adapter feeding the same `RadarAlert` contract; test disconnect/unknown packet behavior before permitting opt-in club sharing. Until then, the R7 uses manual reporting.

## Checks completed

- TypeScript across all seven TypeScript workspaces and repository ESLint.
- Unit tests for published packets, unknown/truncated payloads, laser/mute handling, location freshness, distance/expiry and upload deduplication.
- Mocked native transport tests for capability refusal, read-only operations, interrupted streams, cancelled connections and GATT timeout cleanup.
- Real PostgreSQL semantics in PGlite with production member/club table definitions and emulated Supabase auth: cross-club read/write denial, no self-confirmation, deduplication, rate limits, expiry, revoked membership, invalid GPS, direct-write denial and cascading purge. SQL checks are also runnable against a disposable PostgreSQL database via `tests/radar-postgres.sql`.
- Expo iOS JavaScript/Hermes export and native-config introspection. This is not a signed IPA or a device test.
