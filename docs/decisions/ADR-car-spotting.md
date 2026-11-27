# ADR: SupercarGO

Status: Proposed. MVP on `feature/car-spotting`. Not deployed. Migration applied only to a throwaway database.
Date: 2026-11-27

## Decision

SupercarGO is an optional mode inside UNDERGROUND. Members log the remarkable cars they see, open sealed envelopes left at public places, and keep what they find in the Ledger. It is off until a member turns it on.

It replaces nothing. Spotted stays as the private album. SupercarGO is what a member shares.

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
5. **Blurred server-side, fail closed.** Plates and faces are blurred before anything is stored for others. The original is never kept. If the detector is unavailable or unsure, the sighting is logged privately and never published.
6. **Homes are off the map.** Members may set a private home zone (200 m to 2 km). Nothing captured inside any home zone is published. A member's own garage car is logged privately and earns no folio, so nobody can pin their own car to their own house.
7. **Owners can opt out.** Per garage vehicle. A sighting matching an opted-out car near its owner's zone is kept private. One "owner request" report takes any sighting down.
8. **No following a car.** We store no plates, so sightings of the same car cannot be linked over time.
9. **Spotters are private too.** A sighting shows no spotter unless the member chooses to show their number.
10. **Envelopes only in public places.** Envelopes appear only at curated anchors: route starts and finishes, overlooks, venues, museums and events. Each anchor is reviewed. The database refuses an unreviewed one. No anchor is on a residential street.

## Capture and anti-cheat

Credit needs a fresh capture from inside SupercarGO.

- The app asks the server for a capture nonce, then opens the camera. No library picker in SupercarGO. Library photos stay in Spotted, private, with no folio.
- The nonce is signed with HMAC and bound to the member. Capture must follow it within 5 minutes. Submission must follow capture within 30 minutes.
- A GPS fix within 2 minutes of capture and 100 m accuracy is required.
- Implied travel from the member's last credited sighting may not exceed 300 km/h.
- Exact duplicate photos are refused. Thirty credited sightings a day.
- The photo is re-encoded on the phone, which drops EXIF and location. The server never receives a library photo.
- Envelopes open only through the API, with a live fix within 60 m and 50 m accuracy, once per member.

## The Exchange

- Folio for folio, one to three a side. No money, no auctions, no sale for cash.
- Only envelope folios trade. A sighting folio is a record of something a member saw. It stays with them.
- A folio settles for 24 hours after it is acquired before it can be offered.
- Five open offers per member. An accepted exchange is one atomic swap; any other offer touching the same folios is voided.
- Singular folios trade only between members of 30 days or more.
- Exchanges are visible to their two parties only.

## Commissions

Three a week, Monday to Monday. Counts only. Never speed, never time, never a board ranking one member above another.

Examples: three Numbered or rarer; four different marques; one envelope opened in person; sightings in two different neighborhoods. A completed commission leaves a mark on the member's record.

## Moderation and reports

- Reasons: plate visible, face visible, residential, owner request, stalking, wrong model, not original, spam.
- Safety reasons take the sighting off the map on the first report. Other reasons need three members.
- Reporters stay anonymous to the spotter.
- Every decision (restore, remove, correct the model) carries a written reason the spotter can read. No silent removals.
- Model corrections go to the catalog editors, not to a vote.

## Identification and blurring

Make and model: the existing `POST /v1/spotted/identify` (Qwen3-VL 2B on Aphrodite) suggests; the member confirms. SupercarGO only matches the confirmed text to the catalog.

Blurring pipeline, in the API process:

1. Receive the re-encoded JPEG.
2. Detect plates and faces. Pad each box by 15%.
3. Gaussian blur plus pixelation over each box.
4. Re-detect on the output. Any detection left means fail.
5. Store only the redacted JPEG in the private `supercargo-redacted` bucket. Discard the input.

The MVP ships the interface (`RedactionEngine`) with a fail-closed default, so nothing publishes until a detector is wired. Local options, all able to run on Aphrodite or Atlas CPU:

- Faces: YuNet from OpenCV Zoo (MIT), or SCRFD from InsightFace (check model licence).
- Plates: a YOLO plate detector exported to ONNX (check licence; many Ultralytics weights are AGPL), or an OpenCV cascade as a weak fallback.
- Open-vocabulary detection with a VLM returning boxes is not reliable enough for privacy and is not recommended.

## Data

Migration `20261127000010_supercargo.sql`:

- `supercargo_settings`, `supercargo_catalog`, `supercargo_home_zones`, `supercargo_optouts`
- `supercargo_sightings` (own rows only), `supercargo_sighting_points` (service only)
- `supercargo_anchors`, `supercargo_envelopes` (sealed), `supercargo_envelope_claims`
- `supercargo_ledger`, `supercargo_exchanges`, `supercargo_reports`, `supercargo_moderation`
- `supercargo_commissions`, `supercargo_marks`
- Functions: `supercargo_map`, `supercargo_envelopes_near`, `supercargo_claim_envelope` (service), `supercargo_propose_exchange`, `supercargo_decide_exchange`, `supercargo_privacy_flags` (service), `supercargo_purge` (service)

`tests/supercargo-postgres.sql` holds 30 checks against a throwaway Postgres with PostGIS and emulated Supabase auth.

## API

Enabled only with `SUPERCARGO_ENABLED=1` and a 32+ character `SUPERCARGO_NONCE_SECRET`.

- `POST /v1/supercargo/capture-nonce`
- `POST /v1/supercargo/sightings`
- `POST /v1/supercargo/envelopes/claim`

Reads go to Supabase directly under row-level security.

## Consequences

- No live map. Members who want "where is it now" will not get it, by design.
- The mode is quieter than AutoRadar. Fewer pins, later.
- Catalog quality is ours to keep. Unsourced cars stay Open until someone cites a number.
- Until a blurring detector is wired, SupercarGO is a private logbook with a Ledger.

## Open questions

1. Hold times: 6, 12 and 24 hours by tier. Longer?
2. Cell size: about 2.2 km, and 11 km for the rarest. Coarser?
3. Opt-out matching is by make and model near the owner's zone. Matching on a keyed plate hash would be exact but means reading plates before blurring. Worth it?
4. Events: allow a shorter hold inside a curated event anchor (a Cars and Coffee, say)?
5. Envelope contents: drawn from the catalog weighted toward rarity, or curated weekly?
6. Should club totals of commission marks be shown inside a club? Still no member-against-member boards.
7. Which detector for plates and faces, and where it runs: Aphrodite or Atlas.
8. Where SupercarGO lives: an entry under Drive (MVP) or its own tab.
