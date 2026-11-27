# Finish photo anti-cheat

Decided by TJ on 2026-11-27. Photos still never leave the phone; the server checks a non-image proof.

## 1. Finish nonce (always on when `FINISH_NONCE_SECRET` is set)

- `POST /v1/route-finishes` validates the Run's GPS trace. If it is accepted **and** the finish fix is at
  most 10 minutes old (`FINISH_NONCE_ISSUE_MAX_DELAY_MS`), the response carries
  `finishNonce: { token, issuedAtMs, finishedAtMs, expiresAtMs }`.
- The token is HMAC-SHA256 signed and bound to member, attempt and route. It expires at
  finish + 30 min photo window + 15 min grace (`FINISH_NONCE_GRACE_MS`).
- `POST /v1/run-attempts` must carry `finishNonce`. The server verifies signature, binding and expiry,
  then records the nonce id in `public.run_finish_nonce_uses` (single use; one redeemed nonce per
  attempt; a retry of the same attempt is allowed and the first credit stays final).
- Photo checks then use the **server-signed** finish time, and a photo taken before the nonce was
  issued (more than 15 s skew) is `early`.
- Only in-app camera photos earn credit. Library picks are kept on the phone but flagged
  `library` and earn nothing. The app opens the camera only after the nonce arrives.
- Without a secret: development stays permissive (old behaviour); production, or the integrity flag
  on, fails closed (photos `unverified`, no credit).

## 2. Device attestation (behind `APP_INTEGRITY_REQUIRED`)

- iOS, Apple App Attest via `@expo/app-integrity`:
  1. Once per member per device: `generateKeyAsync()`; `POST /v1/attest/challenge` (signed, 5 min);
     `attestKeyAsync(keyId, challenge)`; `POST /v1/attest/register`. The server verifies the
     attestation (certificate chain to the Apple App Attestation Root CA, nonce extension, key id,
     App ID hash, counter 0, environment AAGUID) and stores the public key in
     `public.device_attest_keys`.
  2. Each proof: the app signs the canonical JSON of the request body (sorted keys, without
     `attestation`; `proofClientData` in `@underground/domain`) with `generateAssertionAsync`.
     The server rebuilds the same string, verifies the ECDSA signature, App ID hash and an increasing
     counter (stored compare-and-set, so a replayed assertion fails).
- Android, Play Integrity: **stub**. `verifyPlayIntegrity` always fails, so with the flag on Android
  photo proofs earn nothing; registration returns 501.
- Flag **on**: a missing or invalid assertion means photos are `unverified` and earn nothing (the run
  itself is still recorded). Flag **off**: nothing is required; an offered assertion is checked and
  stored as `attested` but never blocks.
- `route_run_credits.attested` and `nonce_jti` record how each credit was proven.

## Environment

| Variable | Meaning |
|---|---|
| `FINISH_NONCE_SECRET` | HMAC secret, at least 32 chars. Required in production. |
| `APP_INTEGRITY_REQUIRED` | `true` to require attestation (fail closed). |
| `APPLE_APP_ATTEST_APP_ID` | `<TEAM_ID>.<bundle id>` |
| `APPLE_APP_ATTEST_ENVIRONMENT` | `production` or `development` (must match the entitlement). |
| `ANDROID_PACKAGE_NAME` | For the future Play Integrity check. |

## Apple developer setup needed (TJ)

1. Apple Developer account: on the App ID for the iOS bundle, enable the **App Attest** capability.
2. Add the native module: `npx expo install @expo/app-integrity` (check it supports this Expo SDK; the
   app is on SDK 52 and the module may need an SDK upgrade or a config plugin), then the entitlement
   `com.apple.developer.devicecheck.appattest-environment` = `production` (or `development` for dev
   builds) in `app.json` → `ios.entitlements`.
3. Rebuild the iOS dev client / production build (EAS). Until then the app sends no attestation.
4. Set `APPLE_APP_ATTEST_APP_ID` and `APPLE_APP_ATTEST_ENVIRONMENT` on the API; set
   `FINISH_NONCE_SECRET`; turn `APP_INTEGRITY_REQUIRED=true` only after real devices have registered.
5. App Attest does not work on the iOS Simulator. Apple recommends ramping attestation gradually for
   large user bases.

## What is still weaker without the image

- Capture time and GPS still come from the phone. Attestation proves a genuine app instance signed the
  proof, not that the GPS was not spoofed at the OS level.
- A phone with no signal at the finish gets no nonce, so its photos earn nothing for that run.
- Phone clocks more than 10 minutes behind the server do not get a nonce.
- Registration challenges are signed and expire in 5 minutes but are not single-use.
- Tests use a generated **fake** CA (`services/api/tests/fixtures/make-app-attest-fixture.py`); the
  real Apple root is embedded and checked by fingerprint, but no real device attestation has been run.
