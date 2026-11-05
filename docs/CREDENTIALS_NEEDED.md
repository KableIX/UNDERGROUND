# Credentials needed (do not invent)

Never commit secrets. Never paste passwords, 2FA codes, or signing keys into chat.

## Required before claimed integrations work

| Credential | Used for | Status |
|------------|----------|--------|
| GitHub repo `KableIX/UNDERGROUND` access | Source of truth | Repo exists; CI secrets TBD |
| Apple Developer Program membership | Bundle ID, signing, device installs | Team ID known; interactive Apple login still required |
| Apple Team ID | EAS / Xcode signing | **`2TZCY23DP9`** (in `eas.json` development env) |
| Bundle ID registration `vip.theunderground.app` | iOS identity | Pending EAS Apple session |
| Test device UDID(s) | Internal dev builds | Missing — `eas device:create` (user-interactive) |
| Expo account / org | EAS project | `@undergroundvps-team/underground` linked |
| `EXPO_TOKEN` | CI / agent EAS | Prefer uppercase; lowercase `expo_token` remappable |
| EAS project ID | `app.json` extra.eas.projectId | `fa7e7c16-cf9d-456b-83c9-4a1c985898c9` |
| Supabase project URL | Auth / DB / Storage | Missing |
| Supabase anon key | Client reads | Missing |
| Supabase service role key | API gameplay mutations | Missing |
| Mapbox public access token | Conquest map satellite style | Missing — app uses dark fallback |
| Mapbox secret token | Style/upload ops if needed | Missing |
| Sentry DSN (or equivalent) | Crash / error reporting | Missing |
| Licensed R8 / founder media | Garage & profile seeds | Placeholders only |

## Explicit non-claims

- No signed iOS IPA / device install has been verified.
- No Apple password, 2FA, or ASC API key is stored in the repo or Project docs.
- Monterey geometries remain **draft** placeholders until reviewed.
- Production captures remain disabled.
