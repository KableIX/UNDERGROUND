# UNDERGROUND — Authoritative website design system

**Source of truth:** https://theunderground.vip/ (inspected 2026-11-05).
**Scope:** iOS welcome, identity, garage, navigation, and other non-map chrome.

## Canonical assets (not approximations)

- `apps/mobile/assets/brand/underground-mark.svg`: exact white tachometer/U with red RPM arc from the website's `assets/mark.svg?v=3`.
- `apps/mobile/assets/brand/underground-mark.png`: 512px transparent rendition bundled in React Native to avoid adding an SVG view manager to an older iPhone development client.
- `apps/mobile/assets/brand/garage.jpg`: the site's original 1600×900 garage photograph from `assets/garage.jpg?v=2`.
- **Never substitute** the former gold diamond logo.

## Visual tokens

| Use | Value |
| --- | --- |
| Base/hero black | `#08090A` |
| Body text | `#F4F2ED` |
| Muted text | `#B7B7B8` |
| Champagne gold accent | `#C6B08B` |
| Primary CTA background | `#D0B88F` |
| Logo gauge red | `#E5262B` |
| Modal/panel | `#121314` |

Website typography: **Barlow Condensed** 500/600/700 for headlines, wordmarks, prominent display labels; **Inter** 400/500/600 for UI labels, copy, and forms. Navigation and route controls should use uppercase restrained letterspacing and thin champagne borders.

## UI signature

- Photographic garage hero with black gradient: approximately `rgba(0,0,0,.72)` at top and `rgba(0,0,0,.75)` at bottom. Content remains legible with a dark scrim.
- Large white condensed uppercase wordmark, original white/red tach logo, small gold kicker.
- Copy: **OWNERSHIP IS THE ENTRY.** / **A PRIVATE SUPERCAR SOCIETY.** / **MEMBERSHIP BY INVITATION ONLY.**
- CTA: flat champagne rectangle, dark text, condensed uppercase tracking; avoid blue iOS default buttons, oversized round pills, bright neon or generic gaming UI.
- Modal surfaces near `#121314`, 1px warm-gray borders, no gratuitous shadows.
- Map remains a full real-world map with UI overlay chrome. Our authored territory outlines should not restrict map bounds.

## Development acceptance

1. Compare iOS welcome and garage screens side by side against the live website (not against old placeholder visuals).
2. Confirm native-safe startup: no missing ExpoLinearGradient view manager.
3. Confirm original brand icon in app, not an approximation or unrelated diamond.
4. Confirm foreground map location works independently from drive tracking; review GPS permission and recenter behavior on registered iPhone.
5. Do not claim visual or GPS accuracy until physical device screenshots confirm it.

Do not change the website itself from the app repository without explicit instruction.
