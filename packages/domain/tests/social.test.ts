import { describe, expect, it } from 'vitest';
import {
  applyFriendshipAccept,
  applyFriendshipReject,
  canViewSocialResource,
} from '../src/social';
import { followFixture, pendingFriendship } from '../../../tests/fixtures/clubs-social';

describe('friend + follower visibility', () => {
  it('accepts and rejects pending friendships', () => {
    const accepted = applyFriendshipAccept(
      pendingFriendship,
      pendingFriendship.addresseeId,
      '2026-11-04T03:00:00.000Z',
    );
    expect(accepted.ok).toBe(true);
    if (accepted.ok) expect(accepted.friendship.status).toBe('accepted');

    const rejected = applyFriendshipReject(
      pendingFriendship,
      pendingFriendship.addresseeId,
      '2026-11-04T03:00:00.000Z',
    );
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.friendship.status).toBe('rejected');
  });

  it('friends visibility requires accepted friendship', () => {
    const ownerId = pendingFriendship.addresseeId;
    const viewerId = pendingFriendship.requesterId;
    expect(
      canViewSocialResource({
        viewerId,
        ownerId,
        visibility: 'friends',
        friendships: [pendingFriendship],
        follows: [],
      }),
    ).toBe(false);

    const accepted = {
      ...pendingFriendship,
      status: 'accepted' as const,
      updatedAt: '2026-11-04T03:00:00.000Z',
    };
    expect(
      canViewSocialResource({
        viewerId,
        ownerId,
        visibility: 'friends',
        friendships: [accepted],
        follows: [],
      }),
    ).toBe(true);
  });

  it('followers visibility allows follower edge', () => {
    expect(
      canViewSocialResource({
        viewerId: followFixture.followerId,
        ownerId: followFixture.followeeId,
        visibility: 'followers',
        friendships: [],
        follows: [followFixture],
      }),
    ).toBe(true);
  });
});
