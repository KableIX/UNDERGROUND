# GLM social build status (branch `glm/social`)

Running notes for the reviewer, newest entry first. Nothing from this branch has reached `main`.

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
