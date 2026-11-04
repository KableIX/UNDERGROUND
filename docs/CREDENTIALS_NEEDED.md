# Credentials needed (do not invent)

Nothing below exists in this Project yet. Leave env vars empty until real values are issued. Never commit secrets.

## Required before claimed integrations work

| Credential | Used for | Status |
|------------|----------|--------|
| GitHub repo `KableIX/UNDERGROUND` access | Source of truth | Repo exists; CI secrets TBD |
| Apple Developer Program membership | Bundle ID, signing, device installs | Enrollment processing |
| Apple Team ID | EAS / Xcode signing | Missing |
| Bundle ID registration `vip.theunderground.app` | iOS identity | Proposed only |
| Test device UDID(s) | Internal dev builds | Missing |
| Expo account / org | EAS project | Missing |
| `EXPO_TOKEN` | CI EAS | Missing |
| EAS project ID | `app.json` extra.eas.projectId | Placeholder `REPLACE_WHEN_EAS_PROJECT_LINKED` |
| Supabase project URL | Auth / DB / Storage | Missing |
| Supabase anon key | Client reads | Missing |
| Supabase service role key | API gameplay mutations | Missing |
| Mapbox public access token | Conquest map satellite style | Missing — app uses dark fallback |
| Mapbox secret token | Style/upload ops if needed | Missing |
| Sentry DSN (or equivalent) | Crash / error reporting | Missing |
| Licensed R8 / founder media | Garage & profile seeds | Placeholders only |

## Explicit non-claims

- No Mapbox, Supabase, Apple, or EAS credentials are present.
- No iOS build or device install has been verified.
- Monterey geometries remain **draft** placeholders until reviewed.
