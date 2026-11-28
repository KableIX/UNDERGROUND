# GLM social build status (branch `glm/social`)

Running notes for the reviewer, newest entry first. Nothing from this branch has reached `main`.

## 2026-11-28: slice 3, lint: the agreed exception, and what it left

**Changed**

- `eslint.config.js`: one added block, scoped to `apps/mobile/**`. There, `require()` is allowed when the path being loaded ends in a photo, audio or font file. I scoped it by what is loaded rather than by a list of files, which is narrower: it cannot cover a `require()` of anything else, even inside the photo files.
- `apps/mobile/src/profile/store.ts`: the two `require()` calls left in the one file I had touched (photo picker, photo resizing) now use a lazy `import()`.
- `apps/mobile/tsconfig.json`: one line, `"module": "ESNext"`, so the type checker accepts a lazy `import()`. Expo's base config leaves it unset and TypeScript falls back to a module kind without that syntax. Type-check only: the app's build tooling already handles it.
- Ten `eslint-disable` comments removed in six files. Each sat in front of a photo `require()`, so the exception made it unnecessary and the linter warned about it. Nine single-line comments and one block comment; nothing else changed in those files (`spotted.tsx`, `ActiveRunDashboard.tsx`, `CinematicBackdrop.tsx`, `UndergroundMark.tsx`, `curated-runs.ts` ×5, `supercargo/art.ts`).

**The numbers**

- Before: 608 lint messages. 607 were `require()`. Of those, 590 load a photo, audio or font file and 17 load a phone feature at the moment it is used. The last one is a `console.log` warning in `scripts/supercargo/catalog-seed-sql.ts`.
- After: 16 messages. The exception removed exactly the 590 and nothing else. My two fixes removed 2. What remains is in code I have not touched:
  - `profile/Soundtrack.tsx` (3), `profile/drafts.ts` (1), `profile/preview-store.ts` (1), `profile/ProfileEditor.tsx` (1)
  - `garage/cover.ts` (1), `garage/GarageStage.tsx` (1), `components/GarageCarPhoto.tsx` (1)
  - `drive/guidance-audio.ts` (1), `drive/result-store.ts` (1), `drive/use-navigation-voice.ts` (2)
  - `lib/use-florida-access.ts` (1), `components/feed/LocalEventFeed.tsx` (1)
  - and the one `console.log` warning.
- 0 messages in `apps/members-web`, `packages/domain`, `eslint.config.js` and `apps/mobile/src/profile/store.ts`.

**Why a lazy `import()` and not a normal import**

The app loads phone features at the moment they are used on purpose; its own code says "In-page audio needs the audio-enabled iOS build". A normal import at the top of the file would load the photo picker when the app starts, so on a phone build without that module the app would stop opening instead of only photo picking failing. I checked the app's toolchain before relying on the lazy form: its Babel setup leaves `import()` as it is, and its bundler (Metro 0.81.5) turns it into its own load-on-demand call that runs at the moment of the call and returns the module the same way a normal import does.

**Checks** (AngelFire)

- `pnpm typecheck`: passes in all 7 packages.
- Tests, one package at a time: domain 131, drive-tracking 17, persistence 7, territory-engine 34, mobile 295, api 81. All passing.
- Lint: as in the numbers above.

**Not verified**

- Not on a phone. Picking a profile photo should be tried once on a device; that is the only behaviour these two fixes touch.
- Whole-repo `pnpm lint` still fails, on the 15 above and the one warning. I left them because they are outside the code I touched. They are the same kind of call and would take the same fix.

## 2026-11-28: slice 2, the dev members website

**Changed** (in `apps/members-web`, with its tests in `packages/domain`)

- Sign-in gate. `server.mjs` and the new `lib/dev-data.mjs` check a member session on every request. Without one nothing loads: no member list, no page, no garage. Dev sign-in takes a member number only, because the data is fake.
- `member.html`: a member page built from the same document and tokens as the app's profile screen. Cover and avatar with the member's framing, heading style, panel style, accent and panel colors, cover shape, wallpaper, section order, the member's own section titles, section size, hidden sections, Top 8, build journal, the wall, links, the stats toggles, and a link to the garage.
- `garage.html`: the member's garage, listing each car they show with photo, specifications, installed and planned modifications and class. Only a verified car carries a "Verified" mark.
- Privacy is decided on the server before anything is sent. A friends-only page or garage is refused to anyone who is not a friend, sections a viewer may not see are removed, friends-only cars are removed, and the owner sees everything.
- `public/schema.js`: the plain JavaScript copy of the member page rules (tokens, checks, visitor rules, link allow-lists). It exists because the site has no build step and no dependencies.
- `public/dom.js` builds elements with `textContent` only. `public/theme.js` turns validated tokens into CSS variables. The content-security policy keeps `script-src 'self'` and `style-src 'self'`: no inline script or style anywhere.
- Tests in `packages/domain/tests/member-page-web-parity.test.ts` (13):
  - the token lists are identical;
  - both versions accept and reject the same 50 settings cases (unknown tokens, out-of-range values, injection attempts);
  - both accept and reject the same page and garage documents;
  - both show every visitor the same thing for every fixture page and garage;
  - links normalize identically;
  - the server's own decisions: owner, friend, stranger, signed out, the sign-in answer, the member list.
- Fake data: four members and two garages in `fixtures/`. Web copies of the two app wallpapers in `public/wallpapers/` (83 KB and 155 KB).

**Checks** (AngelFire)

- `pnpm typecheck`: passes in all 7 packages.
- Tests, run one package at a time: domain 131, drive-tracking 17, persistence 7, territory-engine 34, mobile 295, api 81. All passing.
- Lint on everything in `apps/members-web` and the other changed files: clean.
- Run locally (Node 22) and driven in headless Edge at phone width as a member would: signed out, signed in through the real form, opened the member list, a profile, a garage, a friend's profile and a stranger's profile. Screenshots checked. No script errors and no content-policy violations. The only console entry was the 403 from deliberately opening a stranger's private page.
- Against the running server, checking response bodies: signed-out requests get 401; an unknown member gets 404; a friend gets a friends-only page (200) and a stranger gets 403; garage cars filter owner 3, friend 2, stranger 1; after sign-out the session reads signed out.

**Bugs the live run caught, now fixed and covered by tests**

- A friend was refused a friends-only page and garage. The server passed "friend" where the rules expect "friends". No unit test covered the server's own decisions, which is why that test now exists.
- The "am I signed in" check and the member list parsed the cookie twice, so a signed-in member looked signed out and could never have loaded the member list. My first live check only looked at status codes and missed it. The checks now read the answers.

**Not verified**

- Not seen on Atlas. I cannot deploy from here, so the deploy script was not run.
- Not seen in Safari or on a real phone. Only headless Edge at a phone width.
- Headings use built-in fonts. The app loads Barlow Condensed and Inter at run time, so the site's headings are close but not identical until the font files are shipped.
- A favorite drive is left out, because the website has no run catalog. Music does not play on the website; it links out. The wall is read-only.
- Nothing writes. The app saves through the database RPCs, which validate in SQL, and it checks with the shared schema before saving (slice 1). The brief also asks for validation "on write in the API": no HTTP write path exists yet. That comes with real sign-in and the live API.
- Nothing here touches the database.

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
