# UNDERGROUND — Product Spec

## Identity

- **Brand:** UNDERGROUND
- **Website:** https://theunderground.vip
- **Tagline:** OWNERSHIP IS THE ENTRY.
- **Positioning:** Premium invitation-only iOS social network and real-world territory conquest game for verified supercar owners.
- **Founding markets:** California and Miami.

## Design language

Near-black cinematic luxury automotive UI; muted champagne-gold accents; dark satellite maps; glowing road routes; understated motion. Avoid bright hexagon carpets and generic gaming dashboards.

## Core loops

1. **Garage** — Verified vehicles, specs, mods, media, friend-gated visibility.
2. **Conquest** — Own real road territories via verified runs; district crowns by weighted majority.
3. **Newswire** — Event-driven social feed of verified captures and clout.
4. **Friends / Clubs** — Social graph, Top 8, club territory scoring.

## Non-negotiables

- Invitation-only; verified ownership is the gate.
- Server-authoritative gameplay; no client-controlled territory transfers.
- No public-road speed or race-time scoring.
- Founder identity ≠ administrative permissions.
- Simulated evidence never enters production ownership.
- Evidence correlation ≠ cryptographic proof of vehicle identity.
- Draft/unverified routes cannot accept production captures.

## Phase outcomes (summary)

| Phase | Outcome |
|-------|---------|
| 1 | Installable Expo iOS shell + monorepo foundation |
| 2 | Seedable founder profile (000001 / STARK) via audited provisioning |
| 3 | First garage: 2010 Audi R8 V10 with media and access controls |
| 4 | Interactive Monterey District map with versioned draft territories |
| 5 | Deterministic territory engine (solo + club, ledgers, audit) |
| 6 | Verified run pipeline state machine + sim fixtures |
| 7 | Newswire + CLOUT ledger on accepted captures |
| 8 | Clubs, friendships, local opt-in directory |
| 9 | EAS iOS delivery (`vip.theunderground.app`) |

## Quality gates

- No hardcoded secrets; private storage; server-side authz; tested RLS.
- Idempotent mutations; unit + integration tests for majority/capture/concurrency.
- Offline-usable app with safe reconnect reconciliation.
- Location privacy and protected home areas.
