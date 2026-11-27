# Club Drives

Proposed next mobile build under Milestone 8. A verified club keeps a private library of drives. An organizer schedules a drive and each driver opts in with the car they intend to bring.

## Driver experience

1. Sign in with an individual UNDERGROUND account. The club has a verified page managed by named organizers. A member can invite an eligible friend. A driver can also request to join; organizers approve requests. Accepting club membership and accepting a particular drive are separate actions.
2. Open Play → My Club → Drives. Upcoming dates appear first. Saved Drives contains reusable routes with a meet pin, named roads, road-following geometry, approximate mileage, and dated road-condition notes. Fit the entire route on the map. This feature provides an overview and meet information; turn-by-turn navigation is outside its scope.
3. Members can draft a drive for their club. Organizers publish it to the library and choose **Schedule drive**, a date, local meet time, departure time, and meet location. Store instants in UTC and retain the event's IANA time zone for display. Each occurrence references a fixed route revision and can be rescheduled or cancelled independently.
4. A verified club member sees **Join drive**, selects one of their own eligible garage vehicles, chooses Daily or Collector for that entry, and confirms. A unique event/member entry allows car changes and withdrawal until departure. Class describes the car entered; the club's admission and vehicle eligibility rules still apply. Show the member roster and selected cars inside the event.
5. On event day, members see the meet pin, route, and timestamped hazard reports attached to a road or point. Organizers can resolve reports; expired reports drop off the active map. An organizer can record attendance for a checked-in member. Keep the RSVP, attendance, recorded distance, and verified territory result distinct.
6. After the drive, attendees receive a history entry with their car, event, distance if recorded, and optional photos. A share card previews exactly what will leave the club. Default to the route title, broad region, and member-approved photo. Exclude precise meet pins, itineraries, other attendees, and upcoming dates from external shares. No speed or time leaderboard.

## Example

An organizer saves a Saratoga-to-coast drive once and schedules two Saturday departures. A member joins the first in their R8 and skips the second. Changing the vehicle updates one roster row. If the second departure moves, the first event's history stays intact. An RSVP followed by a no-show earns zero distance and zero territory credit.

## Implementation contract

- Reuse clubs, club_memberships, club_invitations, club_events, route_plans, stages and waypoints. Add a club-to-route library relationship and immutable route revisions. Existing route plans have individual owners. Preserve authorship and scope library reads to club membership. The existing route-planning API uses MemoryStore; implement persistent reads/writes before claiming durable club saves.
- Extend club events with route revision, event timezone, meet pin, departure time and lifecycle. Add event RSVP, attendance, hazard and recap records. Enforce vehicle ownership on the server, unique RSVP per event/member, and idempotent attendance and trip credits.
- Enforce verified membership and organizer privileges on the server and in database policies. Check membership on every event, route geometry, roster, hazard and photo read. Invitations, public feed previews, notifications and deep links must not disclose private meet details. Revoke access when membership ends. Confirm revised meeting details in the private event after opening a generic change notification.
- Group distance is the sum of eligible recorded participant miles, counted once per event/member/trip. Display attendance separately when distance is unavailable. Territory changes use the existing accepted-run pipeline and ledger; scheduling, attendance and a group photo alone never grant ownership.
- Decisions to confirm before implementation: who verifies clubs; whether ordinary members can invite directly or require organizer approval; club-specific vehicle eligibility; and whether attendees can opt out of appearing in shared club recap photos. Proposed default is organizer approval and opt-in external sharing.

## Build order and acceptance

1. Private group page, invitations/join requests, persistent saved drives and map preview. Verify a friend outside the group cannot retrieve a route or meet pin by ID.
2. Schedule a saved drive, RSVP per car, switch cars, withdraw, reschedule and cancel. Verify two dates for the same drive have independent rosters. Reject duplicate joins and vehicles belonging to another member.
3. Day-of hazards and attendance, followed by history, photos and share preview. Verify resolved hazards disappear, no-shows receive no history credit, and replaying completion cannot duplicate mileage or territory.
4. Test with two member iPhones and an outside account. Confirm the same map, time and roster appear for both members and private details remain inaccessible to the outside account.

## First planning flow implemented · November 10, 2026

Play → Club Drives loads the signed-in member's verified clubs. Owners and officers save a route from their personal route plans, the NVIDIA template, or a supplied road-following GeoJSON LineString. The first route coordinate is the meet pin. Scheduling stores absolute meet/departure times and the organizer's time zone. Each departure references its immutable route. Drivers can join with their own garage car in Daily or Collector class, change it, or withdraw. Both parties can refresh the roster. Organizers can reschedule or cancel.

For staging, apply supabase/migrations/20261110000001_club_drives.sql to the intended Supabase project after the existing schema. Use two authenticated members, a club with owner/officer and member membership rows, and an owned garage vehicle for the driver. A trusted admin enrolls the approved club by inserting its club_id into public.drive_verified_clubs. The development fixture login does not establish backend membership. This step did not deploy a shared migration or enroll a real club.

Verified mobile typecheck, targeted lint, and Metro iOS HTTP 200 with the Club Drives route and join action in the bundle. Tested the actual migration in isolated PGlite with representative prerequisite tables and authenticated-role sessions. Organizer save, two departures, ownership checks, RSVP replacement, withdrawal, rescheduling, cancellation, and outsider/revoked-member privacy passed. Two physical iPhones and a shared staging database are still needed for end-to-end acceptance. Membership onboarding, hazards, attendance, and recaps are subsequent work.
