# UNDERGROUND — Architecture Decision Records

## ADR-001: pnpm monorepo with Expo mobile + TypeScript API

- **Status:** Accepted
- **Context:** Need shared domain types, a pure territory engine, and an Expo app without coupling gameplay authority to the client.
- **Decision:** pnpm workspaces; `packages/domain`, `packages/territory-engine`, `packages/ui`; `apps/mobile`; `services/api`.
- **Consequences:** Single CI matrix; shared Zod/contracts; engine unit-tested without RN.

## ADR-002: Supabase Auth + Postgres/PostGIS + RLS; API for gameplay mutations

- **Status:** Accepted
- **Context:** Need geo queries, private media, and member-scoped reads, but territory adjudication must be transactional and audited.
- **Decision:** Supabase for auth, storage, and RLS-protected reads; privileged gameplay writes go through `services/api` with service role inside transactions.
- **Consequences:** Clear trust boundary; RLS tests required; no client-owned capture endpoints.

## ADR-003: Mapbox for native maps in Expo development builds

- **Status:** Accepted
- **Context:** Need dark satellite-style maps and road geometry overlays on iOS.
- **Decision:** Mapbox Maps with Expo development-build / config-plugin integration (not Expo Go–only).
- **Consequences:** Requires EAS/dev client; Mapbox token as env secret.

## ADR-004: Draft territories cannot accept production captures

- **Status:** Accepted
- **Context:** Candidate Monterey routes lack reviewed road-following geometry.
- **Decision:** Seed as `draft`; production capture blocked until status `approved` with versioned immutable definition.
- **Consequences:** Map can render drafts; engine rejects production events against draft versions.

## ADR-005: Founder ≠ admin; audited provisioning only

- **Status:** Accepted
- **Context:** Public username must never imply admin; founder needs seedable identity and entitlements.
- **Decision:** Explicit audited provisioning binds auth user → founder member record; admin roles separate.
- **Consequences:** Seed scripts require operator auth; no hardcoded admin-by-username.

## ADR-006: No public-road speed competition

- **Status:** Accepted
- **Context:** Safety and legal risk of racing metrics on public roads.
- **Decision:** Scoring is territory-based (ownership, defense, prestige/clout from verified route completion), never speed or race-time on public roads.
- **Consequences:** GPS used for route fidelity / fraud checks, not competitive speed.

## ADR-007: Simulation hard-gated from production ownership

- **Status:** Accepted
- **Context:** Dev needs GPS/camera fixtures; production ledgers must stay clean.
- **Decision:** Environment + evidence source flags; sim evidence cannot write production ownership tables.
- **Consequences:** Separate fixture pipelines; integration tests assert the gate.

## ADR-009: Optional vehicle-bound identity authentication

- **Status:** Proposed (not part of current MVP release gate)
- **Context:** Sakura proposed one-time BLE pairing and a fresh run-bound visual token to make real-car territory proof effortless.
- **Decision:** Investigate NFC-assisted enrollment of a dedicated cryptographic BLE authenticator bound to a verified garage vehicle. Use fresh backend challenges, independent GPS/photo evidence, and optionally vehicle telemetry. Factory audio Bluetooth and ordinary NFC tags alone do not establish vehicle identity. Support controlled phone replacement and authorized drivers.
- **Consequences:** Future hardware sourcing, provisioning, security reviews, and on-device tests. Do not block the software-only route+photo+odometer protocol. Full proposal: `docs/VEHICLE_IDENTITY_PROTOCOL.md`.
