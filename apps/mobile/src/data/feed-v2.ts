/**
 * Newswire v2 presentation feed — wraps live sim stories + clearly labeled fixtures.
 * Never presents fixtures as genuine verified production captures.
 */

export type FeedProvenance = 'sim' | 'fixture' | 'live';

export type FeedCardKind =
  | 'capture'
  | 'district_takeover'
  | 'garage_photo'
  | 'club_achievement'
  | 'featured_build'
  | 'founder_announcement';

export type FeedCardModel = {
  id: string;
  kind: FeedCardKind;
  provenance: FeedProvenance;
  /** Explicit UI badge text — required for sim/fixture. */
  badge: string;
  actorName: string;
  actorMemberNumber?: string;
  headline: string;
  body: string;
  territoryLabel?: string;
  cloutDelta?: number;
  createdAt: string;
  imageLabel: string;
};

/** Fixture-only presentation cards — not live verified events. */
export const feedFixtureCards: FeedCardModel[] = [
  {
    id: 'fixture-founder-announcement-1',
    kind: 'founder_announcement',
    provenance: 'fixture',
    badge: 'FIXTURE · FOUNDER NOTE',
    actorName: 'STARK',
    actorMemberNumber: '000001',
    headline: 'Ownership is the entry.',
    body: 'Fixture announcement for UI review. Not a live verified capture or ranking event.',
    createdAt: '2026-11-04T00:30:00.000Z',
    imageLabel: 'BRAND PLATE',
  },
  {
    id: 'fixture-garage-photo-1',
    kind: 'garage_photo',
    provenance: 'fixture',
    badge: 'FIXTURE · GARAGE MEDIA',
    actorName: 'STARK',
    actorMemberNumber: '000001',
    headline: 'R8 gallery placeholder',
    body: 'PLACEHOLDER media path only — licensed photography still required. Friend-only garage visibility.',
    createdAt: '2026-11-04T03:00:00.000Z',
    imageLabel: 'PLACEHOLDER PHOTO',
  },
  {
    id: 'fixture-featured-build-1',
    kind: 'featured_build',
    provenance: 'fixture',
    badge: 'FIXTURE · FEATURED BUILD',
    actorName: 'STARK',
    actorMemberNumber: '000001',
    headline: '2010 Audi R8 V10',
    body: 'Featured-build card for presentation. Specs/mods from founder seed only — no invented trophies.',
    createdAt: '2026-11-04T04:00:00.000Z',
    imageLabel: 'R8 FEATURE',
  },
  {
    id: 'fixture-club-1',
    kind: 'club_achievement',
    provenance: 'fixture',
    badge: 'FIXTURE · CLUB',
    actorName: 'Bay Circuit',
    headline: 'Clubhouse fixture',
    body: 'Club achievement card for layout only. No fabricated crowns or verified club captures.',
    createdAt: '2026-11-04T05:00:00.000Z',
    imageLabel: 'CLUB MARK',
  },
];
