# UNDERGROUND — Roadmap

## Milestone 0 — Repo & docs (current gate)

- Confirm GitHub repository destination (do **not** build inside `sakura-harness`).
- Land product docs and setup checklist in Project Context.
- Scaffold pnpm monorepo when repo is ready.

## Milestone 1 — Working app foundation

- Expo iOS app with tabs: Newswire, Conquest, Garage, Friends, Profile.
- Typed config + env validation; migrations stub; API contracts; Vitest; lint; CI.
- No secrets in git.

## Milestone 2 — Founder profile

- Audited provisioning for member `000001` / display name `STARK`.
- Founder flag separate from admin permissions.
- Editable profile, cover, bio, friend/follower counts, Top 8.
- Friend request / accept / remove; founder garage friend-only.
- Founder feature-preview entitlement; normal scoring rules apply.

## Milestone 3 — First garage

- Seed 2010 Audi R8 V10 5.2 Quattro (black, R-Tronic, Vossen HF-5, red ceramics).
- Specs, mod journal (installed vs pending), multi-photo gallery, verification status.
- Visibility / friend-only controls; 3D viewer interface stub (no 3D dependency).

### Vehicle onboarding and build history

Use the member's actual vehicle photo as its cover. Signed owner photos inherit existing garage visibility. Label reference photography and future 3D scenes as concepts. The beta founder preview can display a locally selected photo for the current visit.

| Onboarding step | UNDERGROUND requirement |
| --- | --- |
| Paint or wrap | Record the factory paint or current wrap with its name and optional custom swatch. A render is a preview. |
| Marque and model | Count distinct verified members for make communities and distinct verified cars for model counts. Publish the population and reporting date with a rank. |
| Modifications | Accept stock or modified. Record installed parts by category with installation dates and photos. Keep proposed wheels, aero, exhaust and suspension in a separate experimental build. Moving a part to installed is an explicit owner action. Vehicle identity and individual part verification have separate statuses. |
| Photography | Let the owner choose a real cover photo. If none exists, offer photo upload. Garage environment previews have a separate label. |
| Age eligibility | Keep the eligibility result private. Only the minimum eligibility result should reach the participation check. The public profile never shows a birth date. |
| Sponsorship | Attribute a redeemed invite to the sponsoring member once. Keep founder referral attribution tied to the audited member identity. |
| Driving agreement | Require acceptance of the current agreement before a territory attempt. Keep the accepted version and timestamp. |
| Profile | Combine garage, social identity and accepted territory achievements. Calculate distance, duration and trips from recorded drives. |

The competitor's Audi count and rank are observations from its onboarding screens. UNDERGROUND statistics must come from its own verified records. Paint editing, experimental builds, marque aggregates, eligibility checks, versioned agreement acceptance and the complete onboarding flow are planned. The current garage schema supports vehicle-level verification and installed or pending modification records.

### Garage upgrades

My Garage includes a founder first look and four illustrated store previews. The beta uses sample prices in garage credits.

| Upgrade | Placement | Sample credits |
| --- | --- | ---: |
| Private Garage Theme | Garage environment | 500 |
| Premium Lighting | Garage lighting | 250 |
| Rotating Display | Featured vehicle display | 750 |
| Trophy Showcase | Member profile | 1,000 |

Next steps are to connect earned garage credits to purchases and owned inventory, persist equipped upgrades, and render the selected environment, lighting, turntable and earned trophies. Keep purchases idempotent and apply the member's garage visibility to the customized view.

## Milestone 4 — Conquest map

- Monterey District interactive map (dark base, road glow, ownership panel).
- Versioned seed territories (Highway 1/Big Sur, Carmel Valley, Laureles Grade, 17-Mile Drive, Pacific Grove, Cannery Row, Laguna Seca area) as **draft** until geometries reviewed.
- Solo / club modes; challenge actions UI wired to engine contracts.

## Milestone 5 — Territory engine

- Full deterministic engine + ledgers + concurrent claim tests.

## Milestone 6 — Verified run pipeline

- State machine + sim fixtures first; production evidence path gated.

## Milestone 7 — Newswire & CLOUT

- Event-driven stories, reactions/comments, auditable CLOUT ledger.

## Milestone 8 — Clubs & social

- Clubs, roles, invitations; friend/follower visibility; local opt-in directory.

## Milestone 9 — iOS delivery

- Bundle `vip.theunderground.app`; EAS internal development builds.
- Document device registration / signed build / install commands.
- Do not claim install success until verified. Apple Developer enrollment currently processing.

## Next build under Milestone 8

[Club Drives](CLUB_DRIVES.md) covers private saved routes, dated club events, vehicle RSVPs, attendance, and drive recaps.
