import { z } from 'zod';
import type { MemoryStore } from '@underground/persistence';

const FriendshipActionSchema = z.object({
  friendshipId: z.string().uuid(),
  actorId: z.string().uuid(),
  action: z.enum(['accept', 'reject']),
  nowIso: z.string().datetime().optional(),
});

const TopEightSchema = z.object({
  actorId: z.string().uuid(),
  friendIds: z.array(z.string().uuid()).max(8),
  nowIso: z.string().datetime().optional(),
});

const GuestbookSchema = z.object({
  id: z.string().uuid(),
  profileMemberId: z.string().uuid(),
  authorMemberId: z.string().uuid(),
  body: z.string().min(1).max(500),
  createdAt: z.string().datetime().optional(),
});

const DmSchema = z.object({
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  createdAt: z.string().datetime().optional(),
});

export function handleFriendshipAction(store: MemoryStore, raw: unknown) {
  const body = FriendshipActionSchema.parse(raw);
  const now = body.nowIso ?? new Date().toISOString();
  if (body.action === 'accept') {
    return store.acceptFriendship(body.friendshipId, body.actorId, now);
  }
  const friendship = store.friendships.get(body.friendshipId);
  if (!friendship) return { ok: false as const, error: 'not_found' };
  if (friendship.addresseeId !== body.actorId) {
    return { ok: false as const, error: 'forbidden' };
  }
  const updated = { ...friendship, status: 'rejected' as const, updatedAt: now };
  store.friendships.set(body.friendshipId, updated);
  return { ok: true as const, friendship: updated };
}

export function handleTopEight(store: MemoryStore, raw: unknown) {
  const body = TopEightSchema.parse(raw);
  return store.setTopEight(body.actorId, body.friendIds, body.nowIso ?? new Date().toISOString());
}

export function handleGuestbook(store: MemoryStore, raw: unknown) {
  const body = GuestbookSchema.parse(raw);
  return store.postGuestbook({
    ...body,
    createdAt: body.createdAt ?? new Date().toISOString(),
  });
}

export function handleDm(store: MemoryStore, raw: unknown) {
  const body = DmSchema.parse(raw);
  return store.postDm(body.threadId, {
    id: body.messageId,
    senderId: body.senderId,
    body: body.body,
    createdAt: body.createdAt ?? new Date().toISOString(),
  });
}
