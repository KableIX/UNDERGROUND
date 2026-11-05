import { z } from 'zod';
import type { Friendship } from './friendship';
import type { Profile } from './profile';

export const TopEightUpdateSchema = z.object({
  memberId: z.string().uuid(),
  friendIds: z.array(z.string().uuid()).max(8),
});

export type TopEightUpdate = z.infer<typeof TopEightUpdateSchema>;

function isAcceptedFriend(
  friendships: readonly Friendship[],
  memberId: string,
  friendId: string,
): boolean {
  return friendships.some(
    (f) =>
      f.status === 'accepted' &&
      ((f.requesterId === memberId && f.addresseeId === friendId) ||
        (f.requesterId === friendId && f.addresseeId === memberId)),
  );
}

/**
 * Top 8 may only contain accepted friends. Self slots forbidden.
 * Founder status confers no ranking/admin privilege here.
 */
export function applyTopEight(
  profile: Profile,
  actorId: string,
  friendIds: readonly string[],
  friendships: readonly Friendship[],
  nowIso: string,
):
  | { ok: true; profile: Profile }
  | {
      ok: false;
      error: 'forbidden' | 'too_many' | 'not_friends' | 'self_slot' | 'duplicate';
    } {
  if (profile.memberId !== actorId) return { ok: false, error: 'forbidden' };
  if (friendIds.length > 8) return { ok: false, error: 'too_many' };
  const unique = new Set(friendIds);
  if (unique.size !== friendIds.length) return { ok: false, error: 'duplicate' };
  for (const id of friendIds) {
    if (id === actorId) return { ok: false, error: 'self_slot' };
    if (!isAcceptedFriend(friendships, actorId, id)) {
      return { ok: false, error: 'not_friends' };
    }
  }
  return {
    ok: true,
    profile: {
      ...profile,
      topEight: [...friendIds],
      updatedAt: nowIso,
    },
  };
}
