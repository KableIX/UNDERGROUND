# UNDERGROUND — Title and Intro v1

**Branch:** `feature/title-intro-v1` based on `feature/full-world-map-modes`.

The welcome screen is a cinematic, accessible member entrance, not an unskippable movie. Native splash remains the Expo dark splash until a final branded asset is approved.

Sequence: (1) understated PRIVATE SOCIETY / EST. 2026 header, (2) gold monogram reveal and spring-scale, (3) UNDERGROUND wordmark with gold divider and ownership tagline, (4) existing-member, redeem-invitation and development-only STARK bypass controls. The total staged presentation is approximately 1.5–2 seconds depending on spring completion.

**Behavior:** authenticated users skip the welcome screen via the existing session gate. Reduced-motion accessibility preference reveals everything immediately. Skip Intro terminates the animation and reveals the entry controls; login and invitation navigation remain unchanged. No video, sound, network requests, permissions, analytics, or new native dependencies are introduced.

**Test criteria:** verify login/invite taps after animation and skip, reduced motion, VoiceOver labels, safe area and small iPhone layouts, rapid app relaunch and existing member restoration. All fixture bypasses must remain excluded from production.

**Not included:** final native splash artwork, soundtrack, cinematic video asset or first-run onboarding slides. These need approved brand assets and on-device design review.
