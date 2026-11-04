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
