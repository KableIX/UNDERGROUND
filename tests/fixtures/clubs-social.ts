import type { Club, ClubInvitation, ClubMembership } from '../../packages/domain/src/club';
import type { DirectoryOptIn } from '../../packages/domain/src/directory';
import type { Follow } from '../../packages/domain/src/follow';
import type { Friendship } from '../../packages/domain/src/friendship';

export const clubFixture: Club = {
  id: '44444444-4444-4444-8444-444444444401',
  slug: 'monterey-noir',
  name: 'Monterey Noir',
  foundingMarket: 'california',
  createdByMemberId: '33333333-3333-4333-8333-333333333301',
  createdAt: '2026-11-04T00:00:00.000Z',
};

export const pendingClubInvite: ClubInvitation = {
  id: '55555555-5555-4555-8555-555555555501',
  clubId: clubFixture.id,
  inviterId: '33333333-3333-4333-8333-333333333301',
  inviteeId: '33333333-3333-4333-8333-333333333302',
  status: 'pending',
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
};

export const ownerMembership: ClubMembership = {
  id: '66666666-6666-4666-8666-666666666601',
  clubId: clubFixture.id,
  memberId: clubFixture.createdByMemberId,
  role: 'owner',
  joinedAt: '2026-11-04T00:00:00.000Z',
};

export const pendingFriendship: Friendship = {
  id: '77777777-7777-4777-8777-777777777701',
  requesterId: '33333333-3333-4333-8333-333333333302',
  addresseeId: '33333333-3333-4333-8333-333333333301',
  status: 'pending',
  createdAt: '2026-11-04T00:00:00.000Z',
  updatedAt: '2026-11-04T00:00:00.000Z',
};

export const followFixture: Follow = {
  id: '88888888-8888-4888-8888-888888888801',
  followerId: '33333333-3333-4333-8333-333333333303',
  followeeId: '33333333-3333-4333-8333-333333333301',
  createdAt: '2026-11-04T00:00:00.000Z',
};

export const directoryFixtures: DirectoryOptIn[] = [
  {
    memberId: '33333333-3333-4333-8333-333333333301',
    optedIn: true,
    market: 'california',
    visibleDisplayName: 'STARK',
    updatedAt: '2026-11-04T00:00:00.000Z',
  },
  {
    memberId: '33333333-3333-4333-8333-333333333302',
    optedIn: false,
    market: 'california',
    visibleDisplayName: 'PACIFIC',
    updatedAt: '2026-11-04T00:00:00.000Z',
  },
  {
    memberId: '33333333-3333-4333-8333-333333333304',
    optedIn: true,
    market: 'miami',
    visibleDisplayName: 'BISCAYNE',
    updatedAt: '2026-11-04T00:00:00.000Z',
  },
];
