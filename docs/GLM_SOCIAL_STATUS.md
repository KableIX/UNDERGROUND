# GLM social build status (branch `glm/social`)

Running notes for the reviewer, newest entry first. Nothing from this branch has reached `main`.

## 2026-11-28: slice 1, one shared definition for pages and themes

**Changed**

- `packages/domain/src/member-page.ts` (new). The member page, its theme tokens and its rules moved
  out of the app so there is one definition, as the brief requires. Tokens: sections, wallpaper
  presets, heading styles, panel styles, cover sizes, accents, audiences, section formats, photo
  framing, car classes. Rules: defaults, restoring an older page, save-time checks, link
  allow-lists, who may visit a page, what a visitor receives. Plus a garage page document (each
  car with specs, mods, photos and class).
- `packages/domain/tests/member-page.test.ts` (new), 22 tests: every allowed token; unknown
  tokens; out-of-range values; injection attempts (script URLs, remote or SVG photos, a color
  carrying CSS, handles, links); layout; save checks; refusing a page on read; visitor rules;
  garage rules.
- `apps/mobile/src/profile/page.ts` and `audience.ts` are now thin wrappers over the shared
  definition. No behavior change.
- `apps/mobile/src/profile/store.ts`: a page is checked once more when it is read, before
  anything is drawn from it. A page that breaks the schema now shows "This page could not be
  shown." instead of being drawn.
- One rule got stricter: profile links may not contain spaces, quotes, angle brackets or
  backslashes. The database already refused spaces.

**Checks** (AngelFire)

- `pnpm typecheck`: passes in all 7 packages.
- Tests: domain 118, mobile 295, api 81, all passing.
- Lint on the changed files: clean, apart from two `require()` lines in `store.ts` that predate
  this branch (part of the lint-gate question below).

**Not verified**

- Not seen on a phone, including the new refusal path on read.
- Nothing here changes the database. The app still saves straight to the database RPCs, which
  check every value in SQL; the shared schema and the SQL rules were written to match, and the
  22 tests exercise the schema, not the SQL.

## 2026-11-28: starting point

**Changed**

- `apps/mobile/app/messages/index.tsx`: removed `openDirect`, unused since direct messages open
  by member number. Lint fix only; no behavior change.

**Checks on the untouched starting point (5ed817c)**, run on AngelFire (Windows, Node 22.23):

- `pnpm typecheck`: passes in all 7 packages.
- `pnpm test`: ended with "Test failed" on 2 of 3 runs. Every test passed in every package that
  ran. The command stops because the test runner times out while shutting down its worker
  threads ("Failed to terminate worker", from tinypool) when several packages run at once.
  With one package at a time it passes: `pnpm -r --workspace-concurrency=1 --if-present run test`
  (530 tests, 1 run, no shutdown errors).
- `pnpm lint`: fails before any change on this branch. 608 errors and 1 warning in 31 files.
  - 607 errors are `@typescript-eslint/no-require-imports`. Across `apps/mobile/app` and
    `apps/mobile/src` there are 760 `require()` calls: about 700 load bundled photos, audio and
    fonts; the rest load phone features on demand (camera, location, file storage).
  - Eight of the 31 files are profile and garage code this branch builds on:
    `src/profile/{drafts,preview-store,store}.ts`, `src/profile/{ProfileBody,ProfileEditor,Soundtrack}.tsx`,
    `src/garage/{cover.ts,GarageStage.tsx}`.
  - 1 error was the unused `openDirect` above, now fixed.
  - 1 warning is a `console.log` in `scripts/supercargo/catalog-seed-sql.ts`.

**Not verified**

- No change here has been seen on a phone or on the dev site.
- This entry contains no database change.

**Needs a reviewer decision**

1. Lint gate. The brief requires `pnpm lint` to pass, and it cannot pass without touching files
   from other features. Two ways: (a) a scoped exception in `eslint.config.js`, as already exists
   for `metro.config.js`, for the asset catalogs and the on-demand native loads; (b) rewrite each
   `require()` as an `import`, which changes how those modules load. I recommend (a). I have not
   touched the config.
2. Test gate. On Windows, please accept the one-package-at-a-time command above, or per-package
   runs. I found no failing test.
