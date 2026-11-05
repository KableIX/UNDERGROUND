import { z } from 'zod';

export const DmThreadKindSchema = z.enum(['direct', 'club', 'event']);

export const DmThreadSchema = z.object({
  id: z.string().uuid(),
  kind: DmThreadKindSchema,
  participantIds: z.array(z.string().uuid()).min(2),
  createdAt: z.string().datetime(),
});

export const DmMessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  senderId: z.string().uuid(),
  body: z.string().min(1).max(4000),
  createdAt: z.string().datetime(),
});

export type DmThread = z.infer<typeof DmThreadSchema>;
export type DmMessage = z.infer<typeof DmMessageSchema>;

export function canAccessDmThread(thread: DmThread, memberId: string): boolean {
  return thread.participantIds.includes(memberId);
}

export function sendDmMessage(
  thread: DmThread,
  input: { id: string; senderId: string; body: string; createdAt: string },
):
  | { ok: true; message: DmMessage }
  | { ok: false; error: 'forbidden' | 'empty_body' } {
  if (!canAccessDmThread(thread, input.senderId)) {
    return { ok: false, error: 'forbidden' };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, error: 'empty_body' };
  return {
    ok: true,
    message: DmMessageSchema.parse({
      id: input.id,
      threadId: thread.id,
      senderId: input.senderId,
      body,
      createdAt: input.createdAt,
    }),
  };
}
