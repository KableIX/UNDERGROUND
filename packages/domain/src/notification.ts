import { z } from 'zod';

export const NotificationKindSchema = z.enum([
  'friend_request',
  'friend_accepted',
  'club_invite',
  'capture_accepted',
  'capture_rejected',
  'crown_awarded',
  'dm_received',
  'guestbook_entry',
  'system',
]);

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  kind: NotificationKindSchema,
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  payload: z.record(z.unknown()).default({}),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export function markNotificationRead(
  notification: Notification,
  actorId: string,
  nowIso: string,
):
  | { ok: true; notification: Notification }
  | { ok: false; error: 'forbidden' } {
  if (notification.memberId !== actorId) return { ok: false, error: 'forbidden' };
  return {
    ok: true,
    notification: { ...notification, readAt: nowIso },
  };
}
