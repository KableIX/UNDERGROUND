# GLM social build brief (branch `glm/social`)

Owner: TJ Rego (founder). Reviewer/merger: the parent agent. GLM builds on this branch only; nothing here reaches `main` without review.

## Product (what to build)

UNDERGROUND is an invitation-only network for verified supercar owners. The MySpace-style **member profile and garage** is the centerpiece of the social side.

Order of work:

1. **iOS app first** (`apps/mobile`, Expo). Rich member profiles and garages that members can personalize using a **validated theme-token system**.
2. **Then a private, members-only website** that renders the same profile data (dev build lives in `apps/members-web`).

### Theme tokens (hard rule: no raw HTML or CSS)

- Members never supply HTML, CSS, scripts, or URLs-as-style. They choose from a fixed, versioned set of **theme tokens** (for example palette, accent, background pattern, card style, font family from an allow-list, layout preset, profile song/embed slot from an allow-list).
- Tokens are defined once as a schema in `packages/domain` (zod), validated on write in the API and again on render in both the app and the website. Unknown tokens or out-of-range values are rejected, not sanitized.
- The app and the website render from the same token schema and the same profile data, so a profile looks the same on both.
- All user text is rendered as plain text. Escape on output. No markdown-to-HTML, no inline styles from user data.

### Social rules (decided by TJ)

- **Members-only visibility.** Profiles and garages are visible only to signed-in, approved members. Nothing is public. The website must require member auth, with no anonymous profile pages.
- **DMs are open to any member** on the platform (no prior-connection requirement).
- The old territory capture that needed a start odometer photo is **retired**. Do not reintroduce it.
- Keep the existing SupercarGO card art as is. Do not swap art.

### Domains (planned, not live)

- `api.theunderground.vip`: app API.
- `members.theunderground.vip`: members website.
- `theunderground.vip` is the public invite site on Hostinger (`site/`). **Do not touch it.**

## Rules for the builder

- Work only on branch `glm/social`. Commit in small steps with clear messages.
- **No secrets in the repo**: no keys, tokens, passwords, `.env` files, or real member data. Use fixtures with fake data only.
- Do not change `main`, other branches, or CI/deploy config for the live API or the invite site.
- The dev members site (`apps/members-web`) runs from fixtures only. It has no access to the live API, the database, or member data.
- Build on what already exists (`services/api/src/routes/social.ts`, `packages/domain/src/social.ts`, `apps/mobile/app/members/[id].tsx`, `apps/mobile/app/edit-profile.tsx`, garage routes/media). Prefer extending these over parallel rewrites.
- Add tests for token validation (valid, unknown token, out-of-range, injection attempts). `pnpm typecheck`, `pnpm lint`, and `pnpm test` must pass before you ask for review.
- When a slice is done, write what changed and what you could not verify in `docs/GLM_SOCIAL_STATUS.md`, so the reviewer can check it.

## Dev members site

- Source: `apps/members-web` (zero-dependency Node server, static `public/`, fixtures in `fixtures/`).
- It runs on Atlas, reachable only on the LAN and Tailscale, never public. It is a dev site, not `members.theunderground.vip`.
- Deploy with `deploy-dev.sh` (see `apps/members-web/README.md`). It fetches only `glm/social` and restarts only the dev service.