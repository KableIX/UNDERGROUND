import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStore } from '@underground/persistence';
import {
  handleFriendshipAction,
  handleGuestbook,
  handleTopEight,
} from '../src/routes/social';
import { handleCreateRoutePlan, handleRouteArchitecture } from '../src/routes/route-plans';

const NOW = '2026-11-05T15:00:00.000Z';
const A = '11111111-1111-4111-8111-111111111111';
const B = '44444444-4444-4444-8444-444444444444';
const VEHICLE = '33333333-3333-4333-8333-333333333333';

describe('social + route API handlers', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    store.seedFounder({
      memberId: A,
      authUserId: '22222222-2222-4222-8222-222222222222',
      vehicleId: VEHICLE,
      nowIso: NOW,
    });
    store.members.set(B, {
      id: B,
      authUserId: '55555555-5555-4555-8555-555555555555',
      memberNumber: '000002',
      displayName: 'ALLY',
      isFounder: false,
      role: 'member',
      createdAt: NOW,
    });
    store.profiles.set(B, {
      memberId: B,
      bio: null,
      coverAssetId: null,
      avatarAssetId: null,
      friendCount: 0,
      followerCount: 0,
      topEight: [],
      updatedAt: NOW,
    });
    store.friendships.set('88888888-8888-4888-8888-888888888888', {
      id: '88888888-8888-4888-8888-888888888888',
      requesterId: A,
      addresseeId: B,
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('accepts friendship and sets Top8', () => {
    const accepted = handleFriendshipAction(store, {
      friendshipId: '88888888-8888-4888-8888-888888888888',
      actorId: B,
      action: 'accept',
      nowIso: NOW,
    });
    expect(accepted.ok).toBe(true);
    const top = handleTopEight(store, { actorId: A, friendIds: [B], nowIso: NOW });
    expect(top.ok).toBe(true);
  });

  it('posts guestbook for friends only', () => {
    handleFriendshipAction(store, {
      friendshipId: '88888888-8888-4888-8888-888888888888',
      actorId: B,
      action: 'accept',
      nowIso: NOW,
    });
    const entry = handleGuestbook(store, {
      id: '99999999-9999-4999-8999-999999999901',
      profileMemberId: A,
      authorMemberId: B,
      body: 'Garage goals.',
      createdAt: NOW,
    });
    expect(entry.ok).toBe(true);
  });

  it('rejects fabricated route geometry; exposes CarPlay architecture only', () => {
    const bad = handleCreateRoutePlan(store, {
      id: '12121212-1212-4121-8121-121212121201',
      ownerMemberId: A,
      title: 'Fake road',
      routeClass: 'scenic',
      status: 'draft',
      distanceM: null,
      coordinates: [
        [-122, 37],
        [-123, 38],
      ],
      geometrySource: 'unreviewed_draft',
      gpxSha256: null,
      shareVisibility: 'private',
      waypoints: [
        {
          id: '12121212-1212-4121-8121-121212121202',
          kind: 'start',
          seq: 0,
          label: null,
          lng: -122,
          lat: 37,
        },
        {
          id: '12121212-1212-4121-8121-121212121203',
          kind: 'finish',
          seq: 1,
          label: null,
          lng: -123,
          lat: 38,
        },
      ],
      stages: [],
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(bad.ok).toBe(false);

    const arch = handleRouteArchitecture();
    expect(arch.carPlayEntitlementAssumed).toBe(false);
  });
});
