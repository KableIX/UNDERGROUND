import type { Friendship } from './friendship';
import type { Follow } from './follow';

export type SocialVisibility = 'private' | 'friends' | 'followers' | 'public';

/**
 * Visibility check for member-scoped resources (garage, profile extras).
 * Owner always sees; friends require accepted friendship; followers require follow edge.
 */
export function canViewSocialResource(input: {
  viewerId: string;
  ownerId: string;
  visibility: SocialVisibility;
  friendships: readonly Friendship[];
  follows: readonly Follow[];
}): boolean {
  if (input.viewerId === input.ownerId) return true;
  if (input.visibility === 'public') return true;

  if (input.visibility === 'friends' || input.visibility === 'followers') {
    const isFriend = input.friendships.some(
      (f) =>
        f.status === 'accepted' &&
        ((f.requesterId === input.viewerId && f.addresseeId === input.ownerId) ||
          (f.requesterId === input.ownerId && f.addresseeId === input.viewerId)),
    );
    if (input.visibility === 'friends') return isFriend;

    const isFollower = input.follows.some(
      (f) => f.followerId === input.viewerId && f.followeeId === input.ownerId,
    );
    // followers visibility: friends OR followers
    return isFriend || isFollower;
  }

  return false;
}

export function applyFriendshipAccept(
  friendship: Friendship,
  actorId: string,
  nowIso: string,
):
  | { ok: true; friendship: Friendship }
  | { ok: false; error: 'not_pending' | 'forbidden' } {
  if (friendship.status !== 'pending') return { ok: false, error: 'not_pending' };
  if (actorId !== friendship.addresseeId) return { ok: false, error: 'forbidden' };
  return {
    ok: true,
    friendship: { ...friendship, status: 'accepted', updatedAt: nowIso },
  };
}

export function applyFriendshipReject(
  friendship: Friendship,
  actorId: string,
  nowIso: string,
):
  | { ok: true; friendship: Friendship }
  | { ok: false; error: 'not_pending' | 'forbidden' } {
  if (friendship.status !== 'pending') return { ok: false, error: 'not_pending' };
  if (actorId !== friendship.addresseeId) return { ok: false, error: 'forbidden' };
  return {
    ok: true,
    friendship: { ...friendship, status: 'rejected', updatedAt: nowIso },
  };
}

export function applyFriendshipRemove(
  friendship: Friendship,
  actorId: string,
  nowIso: string,
):
  | { ok: true; friendship: Friendship }
  | { ok: false; error: 'forbidden' | 'not_accepted' } {
  if (friendship.status !== 'accepted') return { ok: false, error: 'not_accepted' };
  if (actorId !== friendship.requesterId && actorId !== friendship.addresseeId) {
    return { ok: false, error: 'forbidden' };
  }
  return {
    ok: true,
    friendship: { ...friendship, status: 'removed', updatedAt: nowIso },
  };
}
