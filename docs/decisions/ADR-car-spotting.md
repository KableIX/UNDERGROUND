# ADR: SupercarGO

Status: Accepted (TJ, 2026-11-27, all seven open questions settled below). Built on `feature/car-spotting`. Not deployed. Migration applied only to a throwaway database.
Date: 2026-11-27

## Decision

SupercarGO is an optional mode inside UNDERGROUND. Members log the remarkable cars they see, open sealed envelopes left at public places, and keep what they find in the Ledger. It is off until a member turns it on.

It replaces nothing. Spotted stays as the private album. SupercarGO is what a member shares.

### Settled 2026-11-27

1. Holds stay at 6, 12 and 24 hours. Cells stay at about 2.2 km and 11 km.
2. Owner opt-out matches make, model and home area. We never read plates, not even to hash them.
3. Curated meets (a reviewed Cars and Coffee, say) get a 1 hour hold. Still fuzzed, members only, never residential.
4. Envelope contents are drawn by rarity. An admin may also set one featured car a week, in about one envelope in ten.
5. Clubs see their members' combined commission marks. No member is ranked against another.
6. Blurring runs on Atlas as its own HTTP service: YuNet for faces, RF-DETR for plates. Nothing is public until blurring is certain.
7. SupercarGO has its own bottom tab.

### Photos stay on the phone

A member's photos belong on their phone, not on our servers. The full-resolution original is saved on the device, in the private Spotted album, and is never uploaded. To log a sighting, the phone sends a 1280 px working copy with all EXIF removed. The API and the blur service hold it in memory only. The one thing we store is the blurred derivative the members map needs. If blurring fails, nothing is stored for others and the sighting stays private.

## Why

Members already spot cars. The existing Spotted album keeps them on one phone. A shared, members-only record of what passes through a neighborhood is worth having, provided it can never become a map of where to find an expensive car tonight.

AutoRadar proved the appetite: a live spotting map, 72-hour sightings, automatic plate and face blurring, collectible cards spawned on a map, Common to Mythic rarity, trading and weekly challenges. We studied its mechanics and its reviews. We took none of its art, card designs, names, text or data. Our catalog, tiers and formula are our own.

## What we learned from AutoRadar

Mechanics, from its App Store listing, site and spot guidelines:

- Sightings stay on a world map for 72 hours, placed "within a distance radius", not at the exact spot.
- Plates and faces are blurred automatically. Car recognition suggests a model.
- Virtual mystery cards spawn on the map daily. Players walk to them to collect. Six tiers, Common to Mythic.
- Trading with offers and negotiation. Weekly spotter challenges, leagues and karma.
- A free card game for people with no supercars nearby.
- Guidelines forbid private property and owner details. Duplicate uploads cost karma. Stolen photos lead to bans.

What members praise: seeing real cars near them, the collecting, the community, no ads.

What they complain about:

- Moderation. Inconsistent, opaque, sometimes reversed days later, with no reason given. Rare but unfamiliar cars rejected.
- Stolen and stale spots. "A million pictures of cars they saw months ago."
- Bugs: crashes on opening cards, failed uploads, lost accounts, broken trades.
- A pickup radius too small without a subscription. Paywalls after a few cards.
- A reset that took everyone's collection without compensation.
- Battery drain. Location is used while the app is closed.
- Rarity as a mood, not a fact.

Each complaint maps to a rule below.

## Names

| Thing | Name |
| --- | --- |
| The mode | SupercarGO |
| A real car a member saw | A sighting |
| The map layer | Sightings |
| A sealed card at a public place | An envelope |
| One collected car | A folio |
| The collection | The Ledger |
| Trading | The Exchange |
| Weekly objectives | Commissions |
| Completing one | A mark |

Rarity tiers come from production numbers, not adjectives:

| Tier | Built (effective) | Meaning |
| --- | --- | --- |
| Open | over 15,000, or unsourced | Series production. |
| Limited | 2,001 to 15,000 | |
| Numbered | 501 to 2,000 | |
| Allocated | 101 to 500 | Sold by allocation. |
| Atelier | 11 to 100 | Built by hand, by the few. |
| Singular | 10 or fewer | |

## Visual language

- Near-black ground, snow type, fog for secondary text. Barlow Condensed for car names, DM Sans for everything else, as in the rest of the app.
- Tiers are typographic: six hairline ticks and a small-caps label. No colored gems, no glow, no card frames.
- Gold appears three times: the primary action, the short rule under the title, and Singular. Nothing else is gold.
- Sightings are soft discs over a neighborhood, sized by count. Never a pin. Envelopes are small outlined rings.
- No XP, levels, streaks, confetti, sounds, flames or countdown timers. A completed commission turns its title gold. That is the celebration.
- Copy is short and certain. "Logged. Members see it in 12 hours, at neighborhood scale."

## Rarity

Tier is a fact. Score orders cars within a tier and never moves one across a boundary.

```
survival = 1.0 under 15 years, 0.8 under 30, 0.6 under 50, 0.4 beyond
effective = ceil(built × survival)
tier      = band(effective)                       // table above
base      = 100 − 20 × log10(effective)           // 1 → 100, 10 → 80, 100 → 60 …
score     = clamp(base − min(8, 4·log10(1 + member sightings, 90 days))
                       − min(4, member garages holding it),
                  tier band)
```

Production numbers come from public manufacturer statements, cited per entry. No citation, no tier above Open. Our own data adjusts the score: member sightings and member garages. Nobody else's sighting counts are used. The seed catalog is in `packages/domain/src/supercargo-catalog.ts` and every figure must be re-checked against its source before launch.

## Theft safety

A live map of where supercars are parked is a gift to thieves. Every rule below defaults to private.

1. **Members only.** No public web view, no share links to the map, no API without a member session.
2. **Delayed.** Nothing appears until the car has most likely left: 6 hours for Open and Limited, 12 for Numbered and Allocated, 24 for Atelier and Singular. Visible until 72 hours after capture. The database refuses a hold under 6 hours.
3. **Fuzzed.** The server snaps every sighting to a grid cell: about 2.2 km, or about 11 km for Atelier and Singular. The map shows cells, not points, and the date, not the hour. Map zoom stops at neighborhood scale.
4. **Precise points are service-only.** Kept for anti-cheat, readable by no member, purged after 30 days.
5. **Blurred server-side, fail closed.** Plates and faces are blurred before anything is stored for others. The original stays on the member's phone and is never uploaded. If the detector is unavailable or unsure, the sighting is logged privately and never published.
6. **Homes are off the map.** Members may set a private home zone (200 m to 2 km). Nothing captured inside any home zone is published. A member's own garage car is logged privately and earns no folio, so nobody can pin their own car to their own house.
7. **Owners can opt out.** Per garage vehicle, matched on make, model and home area. Plates are never read. A sighting matching an opted-out car near its owner's zone is kept private. One "owner request" report takes any sighting down.
8. **No following a car.** We store no plates, so sightings of the same car cannot be linked over time.
9. **Spotters are private too.** A sighting shows no spotter unless the member chooses to show their number.
10. **Envelopes only in public places.** Envelopes appear only at curated anchors: route starts and finishes, overlooks, venues, museums and events. Each anchor is reviewed. The database refuses an unreviewed one. No anchor is on a residential street.
11. **Curated meets.** An admin opens a meet on a reviewed `curated_meet` anchor: a window of at most 12 hours, a radius of 50 to 400 m. A sighting captured inside it is held 1 hour instead of 6 to 24, still snapped to the same cells. Never inside a home zone. The database checks the capture time against the meet window.
12. **Purged on a schedule.** `supercargo_purge()` runs daily at 03:17 UTC through pg_cron: precise points after 30 days, photo hashes after 90. Where pg_cron is missing the migration says so and the job must be scheduled elsewhere.

## Capture and anti-cheat

Credit needs a fresh capture from inside SupercarGO.

- The app asks the server for a capture nonce, then opens the camera. No library picker in SupercarGO. Library photos stay in Spotted, private, with no folio.
- The nonce is signed with HMAC and bound to the member. Capture must follow it within 5 minutes. Submission must follow capture within 30 minutes.
- A GPS fix within 2 minutes of capture and 100 m accuracy is required.
- Implied travel from the member's last credited sighting may not exceed 300 km/h.
- Duplicate photos are refused: the exact SHA-256, and a 64-bit difference hash within 6 bits, kept server-side for 90 days in `supercargo_image_hashes` (service only). Thirty credited sightings a day.
- The photo is re-encoded on the phone, which drops EXIF and location. The server never receives a library photo.
- Envelopes open only through the API, with a live fix within 60 m and 50 m accuracy, once per member.

## The Exchange

- Folio for folio, one to three a side. No money, no auctions, no sale for cash.
- Only envelope folios trade. A sighting folio is a record of something a member saw. It stays with them.
- A folio settles for 24 hours after it is acquired before it can be offered.
- Five open offers per member. An accepted exchange is one atomic swap; any other offer touching the same folios is voided.
- Singular folios trade only between members of 30 days or more.
- Exchanges are visible to their two parties only.
- In the app: Exchange section, then Propose. Enter a member number, pick up to three of yours and three of theirs, send. Offers waiting for you show a count on the section and Accept or Decline on the card.

## Commissions

Three a week, Monday to Monday. Counts only. Never speed, never time, never a board ranking one member above another.

Examples: three Numbered or rarer; four different marques; one envelope opened in person; sightings in two different neighborhoods. A completed commission leaves a mark on the member's record.

Progress is computed live from sightings and envelope claims (`supercargo_my_commissions`). Exchanged folios never count. `supercargo_settle_marks` writes the week's marks every Monday at 00:20 UTC and is safe to run twice. `supercargo_my_club_marks` shows each club the caller belongs to with its combined marks this week and in all. Totals only, no member list, no order.

## Envelopes

`supercargo_stock_envelopes` (service) fills an anchor. Each envelope draws a tier by weight (Open 40, Limited 25, Numbered 18, Allocated 10, Atelier 5, Singular 2), then a car from that tier. About one in ten holds the week's featured car instead, if an admin has set one in `supercargo_featured`. The same draw lives in the domain package as `drawEnvelopeContents`.

## Moderation and reports

- Reasons: plate visible, face visible, residential, owner request, stalking, wrong model, not original, spam.
- Safety reasons take the sighting off the map on the first report. Other reasons need three members.
- Reporters stay anonymous to the spotter.
- Every decision (restore, remove, correct the model) carries a written reason the spotter can read. No silent removals.
- Model corrections go to the catalog editors, not to a vote.
- In the app: REPORT beside each recent sighting under the map opens the report sheet (reason, optional note). Admins work the queue under Admin: Restore, Remove or Correct the model, each with a written reason. The spotter reads every decision, and every hold, under Reviews in the Ledger.

## Identification and blurring

Make and model: the existing `POST /v1/spotted/identify` (Qwen3-VL 2B on Aphrodite) suggests; the member confirms. SupercarGO only matches the confirmed text to the catalog.

Blurring runs as `services/blur`, a small Python HTTP service on Atlas, CPU only. Installed 2026-11-27 as `supercargo-blur.service` on `10.0.0.93:8791`, not yet wired into the API. It has no access to any GPU, is capped at 4 cores at low priority, and takes one photo at a time (p50 5.3 s on Atlas).

1. The API posts the EXIF-free working copy to `POST /v1/redact` with a bearer token. Nothing is written to disk and requests are not logged.
2. Faces: YuNet (`face_detection_yunet_2023mar.onnx`, OpenCV Zoo, MIT). Plates: RF-DETR medium plate detector (`rf-detr-medium-plate.onnx`, Hugging Face `imbcmdth/rfdetr-onnx`, Apache-2.0), run on the full frame and four overlapping tiles. Both files are pinned by SHA-256 in `fetch_models.sh`.
3. Each box is padded 15%, then pixelated on a coarse grid and blurred.
4. Both detectors run again on the result. Anything found is obscured again, wider, up to three rounds. Anything left after that means fail.
5. The service returns the redacted JPEG and a difference hash. The API stores only that in the private `supercargo-redacted` bucket.

Any error, timeout, bad token or residual detection is a fail, and a fail keeps the sighting private. With no `SUPERCARGO_BLUR_URL` set, the API uses the fail-closed engine and nothing publishes.

Rejected: Ultralytics plate weights (AGPL-3.0) and the open-image-models YOLOv9 plates (trained with GPL-licensed code). Fallback if RF-DETR disappoints: an Apache-2.0 RT-DETRv2 plate model. A VLM returning boxes is not reliable enough for privacy.

## Data

Migration `20261127000010_supercargo.sql`:

- `supercargo_settings`, `supercargo_catalog`, `supercargo_home_zones`, `supercargo_optouts`
- `supercargo_sightings` (own rows only), `supercargo_sighting_points` (service only)
- `supercargo_anchors`, `supercargo_envelopes` (sealed), `supercargo_envelope_claims`
- `supercargo_ledger`, `supercargo_exchanges`, `supercargo_reports`, `supercargo_moderation`
- `supercargo_commissions`, `supercargo_marks`
- `supercargo_meets`, `supercargo_featured`, `supercargo_image_hashes` (service only)
- Admin and moderation functions: `supercargo_is_admin`, `supercargo_admin_anchors`, `supercargo_admin_save_anchor`, `supercargo_admin_stock`, `supercargo_admin_queue`, `supercargo_admin_decide`, and for spotters `supercargo_my_moderation`
- Functions: `supercargo_map`, `supercargo_envelopes_near`, `supercargo_claim_envelope` (service), `supercargo_propose_exchange`, `supercargo_decide_exchange`, `supercargo_privacy_flags` (service), `supercargo_meet_at` (service), `supercargo_image_seen` (service), `supercargo_stock_envelopes` (service), `supercargo_my_commissions`, `supercargo_settle_marks` (service), `supercargo_my_club_marks`, `supercargo_tradeable_folios`, `supercargo_my_exchanges`, `supercargo_purge` (service)

`tests/supercargo-postgres.sql` holds 55 checks against a throwaway Postgres with PostGIS and emulated Supabase auth.

## API

Enabled only with `SUPERCARGO_ENABLED=1` and a 32+ character `SUPERCARGO_NONCE_SECRET`. Blurring is used only when `SUPERCARGO_BLUR_URL` and a 32+ character `SUPERCARGO_BLUR_TOKEN` are set.

- `POST /v1/supercargo/capture-nonce`
- `POST /v1/supercargo/sightings`
- `POST /v1/supercargo/envelopes/claim`

Reads go to Supabase directly under row-level security.

## Consequences

- No live map. Members who want "where is it now" will not get it, by design.
- The mode is quieter than AutoRadar. Fewer pins, later.
- Catalog quality is ours to keep. Unsourced cars stay Open until someone cites a number.
- Until the API is pointed at the blur service, SupercarGO is a private logbook with a Ledger.
- We hold no originals, so a lost phone means lost originals. Spotted is the member's album to back up.

## Admin

Admins are members with `role = 'admin'`. Every admin function checks it in the database. The Admin screen (header link, admins only) has four sections:

- **Queue**: reported sightings, held ones first, with the blurred photo, report reasons and notes. Reporters are never shown.
- **Places**: envelope places with open envelopes and what is left. Add a place (name, kind, coordinates or "use where I am", and a required "public place, not a residential street" confirmation). Stock a place now for 1 to 72 hours. Pause or resume a place.
- **Meets**: create a curated meet on a curated-meet place (start, up to 12 hours, 50 to 400 m), or remove one.
- **Featured**: pick this week's or next week's featured car from the catalog, with an optional note.

## Navigation

```
Tab bar ── SupercarGO (own tab)
   ├─ MAP       sightings by cell, reloads as you pan · recent sightings · featured car · envelopes → Open
   ├─ LEDGER    folios by tier · commissions · clubs' combined marks · reviews of your sightings
   ├─ EXCHANGE  offers (Accept / Decline / Withdraw) · Propose → /supercargo/propose
   ├─ PRIVACY (header) → /supercargo/privacy: on/off, show number, home zone, per-car opt-out
   ├─ ADMIN (header, admins only) → /supercargo/admin: Queue · Places · Meets · Featured
   ├─ REPORT (beside each recent sighting) → /supercargo/report
   └─ LOG A SIGHTING (fixed button, every section) → /supercargo/capture
```

Every core action is one or two taps from the tab. Each pushed screen has a back link to where it came from. Each section has a plain empty state. With SupercarGO off, the tab shows one screen and one button: turn it on.

## Open questions

1. Who reviews curated-meet anchors and featured cars, and how often.
2. Catalog figures need a second check against their sources before launch.
