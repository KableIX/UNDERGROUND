# Jacob's Pass status
Owner: TJ. Writer: ChatGPT. Release owner: TJ.
Objective: Add Palomares Road as Jacob's Pass to the active UNDERGROUND beta and provide a mapped preview.
Workspace: C:\Users\god\underground\UNDERGROUND-play-simple; fix/play-single-screen; HEAD 8e7dbc8 plus existing WIP.
Milestone: Implemented and tested; updated iOS bundle served by active Metro. Phone display not independently observed.
Route: EB01 / jacobs-pass; 9.6738 miles; estimated 24.6 minutes; 499 OSRM/OpenStreetMap vertices. Southbound from Palo Verde Road to Niles Canyon Road.
Navigation: California > San Francisco Bay > East Bay > Castro Valley–Niles Canyon > Jacob's Pass.
Checks: 66/66 catalog and navigation tests passed; Metro iOS bundle HTTP 200 containing route.
Screenshot: Private beta unavailable to screenshot browser; delivered rendered preview from current route screen code, typography and static satellite map adapter. Not a direct iPhone capture.
Uncertainty: Field conditions, low-car clearance, staging and on-device visual appearance remain unverified. Capture remains disabled by existing app behavior.
Recovery: before/ holds originals for the three modified files; new geometry is apps/mobile/src/data/jacobs-pass-route.json. Preserve subsequent edits before rollback.
Evidence: WORK-LEDGER.jsonl. Standard: C:\Users\god\PROJECT-EVIDENCE-STANDARD.md.
Stopping point: Route served; rendered map preview saved as Jacobs-Pass-UNDERGROUND-preview.png. User can reload beta to view.

## Official designation — 2026-11-17 Pacific
Jacob’s Pass / EB01 is now official in the UNDERGROUND catalog. The selector reads Official Run and the route detail reads OFFICIAL RUN. This is editorial publication; existing field screening and capture behavior remain independent.
Validation: 69/69 existing catalog, route-following, screening and cover checks passed. Active iOS Metro bundle returned HTTP 200 with EB01 official status and both UI labels. HTTPS server returned the UNDERGROUND project manifest at https://aphrodite.tail32f2e6.ts.net:18443.
Delivery: User can connect through the existing Tailscale server URL. On-device display has not been independently observed. Updated files backed up in before-official/. No further implementation work pending for official designation.


## East Bay photo
EB01 now uses catalog-eb01.jpg: Niles Canyon aerial by Dicklyon, CC BY-SA 4.0, with in-app source and credits. East Bay and territory covers inherit the route image. Source: https://commons.wikimedia.org/wiki/File:Niles_Canyon_aerial_with_Niles_Canyon_Mobile_Estates_and_Alameda_Creek_in_center_foreground.jpg
Verified: image visually inspected (1280x964); iOS Metro bundle HTTP200 with asset and credits; image endpoint HTTP200 with identical bytes; existing cover tests 2/2 passed. On-device display not independently observed. Backup: before-photo/california-photos.ts. Rollback removes EB01 photo entry and catalog-eb01.jpg, preserving later edits.
