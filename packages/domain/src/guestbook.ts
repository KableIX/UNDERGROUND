import { z } from 'zod';
import type { Friendship } from './friendship';

export const GuestbookEntrySchema = z.object({
  id: z.string().uuid(),
  profileMemberId: z.string().uuid(),
  authorMemberId: z.string().uuid(),
  body: z.string().min(1).max(500),
  createdAt: z.string().datetime(),
});

export type GuestbookEntry = z.infer<typeof GuestbookEntrySchema>;

function areAcceptedFriends(
  friendships: readonly Friendship[],
  a: string,
  b: string,
): boolean {
  return friendships.some(
    (f) =>
      f.status === 'accepted' &&
      ((f.requesterId === a && f.addresseeId === b) ||
        (f.requesterId === b && f.addresseeId === a)),
  );
}

/** Guestbook writes require accepted friendship; owner cannot write own book. */
export function createGuestbookEntry(
  input: {
    id: string;
    profileMemberId: string;
    authorMemberId: string;
    body: string;
    createdAt: string;
  },
  friendships: readonly Friendship[],
):
  | { ok: true; entry: GuestbookEntry }
  | { ok: false; error: 'forbidden' | 'not_friends' | 'self_entry' } {
  if (input.profileMemberId === input.authorMemberId) {
    return { ok: false, error: 'self_entry' };
  }
  if (!areAcceptedFriends(friendships, input.profileMemberId, input.authorMemberId)) {
    return { ok: false, error: 'not_friends' };
  }
  return {
    ok: true,
    entry: GuestbookEntrySchema.parse({
      id: input.id,
      profileMemberId: input.profileMemberId,
      authorMemberId: input.authorMemberId,
      body: input.body.trim(),
      createdAt: input.createdAt,
    }),
  };
}
