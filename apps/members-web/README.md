# members-web (dev)

Dev build of the private members website. Zero dependencies (plain Node 22), no `package.json` on purpose so the pnpm workspace and lockfile are not affected.

## What it does

- **Sign-in gate.** Nothing loads without a member session (a cookie the server sets). The server checks it on every request.
- **`member.html?id=<member>`**: a member page rendered from the same theme tokens and data as the app's profile screen.
- **`garage.html?id=<member>`**: the member's garage, each car with photos, specifications, modifications and class.
- **Fake data only**, in `fixtures/`. No live API, no database, no member data.

## Files

- `server.mjs`: static server for `public/`, `/healthz`, and `/api/dev/*` (sign-in, sign-out, session, member list, page, garage).
- `lib/dev-data.mjs`: loads the fixtures, decides who may see what, and removes anything the viewer may not see before it is sent.
- `public/schema.js`: plain JavaScript copy of the member page rules. The source of truth is `packages/domain/src/member-page.ts`; `packages/domain/tests/member-page-web-parity.test.ts` holds this copy to it.
- `public/app.js`, `member.js`, `garage.js`: the three pages. `dom.js` builds elements with `textContent` only. `theme.js` turns validated tokens into CSS variables.
- Env: `PORT` (default 8795), `BIND_HOSTS` (comma list), `BUILD_SHA`.

## Rules this build keeps

- Member text is only ever written as text. Links are only drawn from the allow-lists in `schema.js`.
- Colors and styles come from the fixed token lists. A member never supplies CSS or markup.
- A page or garage that fails the checks is not drawn ("This page could not be shown.").
- The server never sends a section the viewer may not see.

## Not in this build

- Music does not play here. The page links out to Spotify or Apple Music.
- A favorite drive is left out. The website has no run catalog yet.
- The wall is read-only.
- Dev sign-in takes a member number only. Real sign-in comes with the live API.
- Headings use built-in fonts. The app loads Barlow Condensed and Inter at run time; the site would need the font files to match exactly.

## Run locally

```
node apps/members-web/server.mjs
```

Then open http://127.0.0.1:8795/ and sign in with 000001, 000002, 000003 or 000004.

## Tests

The rules copy is tested from `packages/domain`:

```
pnpm --filter @underground/domain test
```

## Atlas deploy

On Atlas as user `glm-dev`, run `/home/glm-dev/bin/deploy-dev.sh`. It fetches `glm/social` only and restarts `underground-members-dev.service`. The site is LAN and Tailscale only.
