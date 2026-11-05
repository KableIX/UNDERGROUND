# UNDERGROUND — Vehicle Identity Protocol (VIP) concept

**Status:** Proposed; future enhancement, not implemented or required for initial capture MVP.
**Source:** Sakura's proposal for effortless car-bound verification, refined for realistic threat modeling.

## Product goal

After one-time onboarding, associate a member's verified supercar and iPhone with an authenticated vehicle device. Use that association as an additional, low-friction source of evidence when adjudicating real-world territory runs.

Support an optional **personal vehicle name** (e.g. "The Red Ghost" or "Tuesday") alongside immutable verified make/model/vehicle records. Display the nickname in garage galleries, run history and the Newswire without changing the underlying verified identity.

## Recommended user flow

1. **Garage verification:** Member registers a qualifying vehicle and completes separate ownership review.
2. **Device enrollment:** An optional dedicated, provisioned hardware authenticator is installed/verified in that vehicle. An NFC tap can launch BLE discovery and display the relevant device identity. NFC tag contents alone are not trusted.
3. **Secure binding:** The iPhone authenticates the hardware identity, completes a proof-of-possession challenge, and the backend associates its public key/device identifier with the garage vehicle and permitted driver/member.
4. **Run start:** Issue a fresh short-lived backend challenge bound to run ID, territory-version ID, vehicle ID, permitted member, server timestamp, and nonce. Authenticator signs a canonical challenge payload; backend verifies signature and replay protection. Keep device private keys non-exportable where hardware permits.
5. **During run:** Collect signed freshness observations at intervals, device heartbeat, reported BLE proximity, GPS samples and optional read-only vehicle telemetry (e.g. RPM/odometer). Each is independent evidence with quality metadata.
6. **Finish:** Route/checkpoint validation plus in-app finish photo, timestamp and location evidence. Odometer photos remain available, and can be required for prestige territory captures. Do not require manipulation of the app while driving.
7. **Adjudication:** Server evaluates evidence quality, fraud signals and completion conditions, then records verified outcome. One vehicle/run may credit at most one designated participant, with explicitly authorized shared-driver policies.
8. **Publishing:** Private raw evidence stays access-controlled. An opt-in sanitized finish photograph and event summary may appear in photographic territory history and Newswire; remove sensitive EXIF/GPS data from public derivatives.

## Critical security truths

- **Factory Bluetooth audio pairing is not identity attestation.** Most factory head units do not expose a trustworthy signed vehicle identity, and not all vehicles permit a usable programmatic connection.
- **A BLE session attests an authenticator, not the surrounding vehicle or actual driver.** An authenticator can be relocated, spoofed if poorly designed, or relayed; require installation verification and independent consistency checks.
- **Phone-only NFC tags and static QR codes are cloneable.** Use them for discovery/onboarding, not for proof of physical vehicle presence.
- **A server-issued nonce/photo token proves challenge freshness, not the photographed physical car.** A digitally composited code can be copied into fabricated imagery. Don't claim that a same-phone camera can photograph its own on-screen code as a physical proof.
- **Device attestation is distinct from vehicle attestation.** Apple App Attest can strengthen client integrity but does not establish car identity.
- **GPS, timestamps, phone sensor data, photos, odometer OCR and BLE are correlating signals, not absolute proofs.** Server decisions should be labeled by evidence class rather than claiming cryptographic proof of a complete drive.
- **No permanent one-phone lockout.** Support auditable device replacement, revocation and lost-device recovery, with cooldowns and multifactor authorization. Limit simultaneous credited runs.
- **Privacy:** No public live vehicle tracking by default; avoid exposing garage/home coordinates and raw GPS proof in Newswire.

## Release tiers

| Tier | Evidence | Intended use |
| --- | --- | --- |
| GPS_VALIDATED | Route tracking, plausible checkpoints | Exploration and development |
| PHOTO_VERIFIED | GPS + in-app finish photo + optional start/end odometer | Standard verified captures |
| VEHICLE_CORRELATED | PHOTO_VERIFIED + signed device sessions and consistency checks | High-assurance events once hardware is validated |

Implementation must preserve separate production/simulation data, server-authoritative territory transfer and no public-road speed scoring.

## Open engineering questions

- Device vendor vs custom design, secure-element provision model and physical installation validation.
- iOS Core Bluetooth background reconnection, Bluetooth restoration and NFC availability on target vehicles.
- Hardware/vehicle telemetry interoperability across Audi R8, Lamborghini, Ferrari and Porsche models.
- Relay attacks, transferred hardware and recovery abuse.
- Device provisioning cost, battery/power, support and replacement workflow.
- Capture-policy versioning per territory and evidence-tier requirements.

**Decision:** Research and prototype later; do not let hardware dependencies block the founder garage, Silicon Valley conquest, or first production-worthy run verification.
