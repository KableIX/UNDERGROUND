# Spotted

Play → Spotted opens the member's collection on this device. Spot a Car uses the camera and From Photos opens the system picker. Identify from photo sends a resized JPEG to the signed-in member API. The spotter can confirm or edit the make, model and optional area before saving. Each sighting owns its photo copy. The album groups normalized make/model names, keeps repeat sightings and tracks the V10 Icons set. Share photo opens the native share sheet.

## Service setup

The existing mobile member session uses EXPO_PUBLIC_API_URL and the existing Supabase configuration. Configure SPOTTED_VISION_URL and SPOTTED_VISION_MODEL in the API process environment. SPOTTED_VISION_KEY is optional and server-only. Aphrodite's tested settings are http://127.0.0.1:11434/v1/chat/completions and qwen3-vl:2b. A client without a live member session can still capture, label and save locally. The collection has no cross-device sync.

Apply supabase/migrations/20261108000001_spotted_owner_confirmation.sql in the target Supabase environment to enable owner requests. The spotter explicitly selects a visible garage vehicle and sends a small photo preview to its owner. The owner opens Spotted to confirm or decline. A confirmed sighting links to the owner's visible garage vehicles. The request and garage reads are subject to database row-level security.

## Verification

Mobile and API TypeScript passed, as did focused ESLint and 36 API/collection tests. Metro returned an iOS bundle with the Spotted route. The server recognition function returned Audi R8 from a cropped illustration of an R8 using local Qwen3-VL. In an isolated PGlite database, with representative member and vehicle policies, the migration allowed a request and owner confirmation, rejected a forged member number, prevented the spotter from confirming, isolated unrelated members, and hid the confirmation after vehicle privacy changed. The migration has not been applied to a shared database. Camera capture and the share sheet still require a physical iPhone smoke test.
