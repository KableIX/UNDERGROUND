import { z } from 'zod';

/**
 * Direct messages and club chat: shared contracts and pure rules.
 * The server enforces every rule here; the app uses the same types to display threads.
 */
export const MESSAGE_BODY_MAX = 2000;
export const MESSAGE_PAGE_DEFAULT = 50;
export const MESSAGE_PAGE_MAX = 100;
export const MESSAGE_RATE_LIMIT = 30;
export const MESSAGE_RATE_WINDOW_MS = 60_000;

export const MessageBodySchema = z.string().trim().min(1).max(MESSAGE_BODY_MAX);
export const ReportReasonSchema = z.enum(['spam', 'harassment', 'threat', 'doxxing', 'other']);

export const ChatThreadKindSchema = z.enum(['direct', 'club']);
export const ChatThreadSchema = z.object({
  id: z.string().uuid(),
  kind: ChatThreadKindSchema,
  clubId: z.string().uuid().nullable(),
  /** Club name for club threads; the other member's display name for direct threads. */
  title: z.string(),
  /** The other member's number for direct threads. */
  memberNumber: z.string().nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  lastMessagePreview: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
  participantIds: z.array(z.string().uuid()),
});
export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  senderId: z.string().uuid(),
  senderName: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
});

export type ChatThread = z.infer<typeof ChatThreadSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ReportReason = z.infer<typeof ReportReasonSchema>;

/**
 * Club threads follow live club membership, so access ends when membership does.
 * Direct threads follow the participant list.
 */
export function canUseThread(
  thread: { kind: string; clubId: string | null; participantIds: readonly string[] },
  memberId: string,
  clubMemberIds: readonly string[],
): boolean {
  if (thread.kind === 'club') return thread.clubId !== null && clubMemberIds.includes(memberId);
  return thread.participantIds.includes(memberId);
}

/**
 * Starting a one-on-one DM is allowed with any other member on the platform.
 * Profile page visibility is not a factor. Self-DMs and blocks are refused.
 */
export function canStartDirectMessage(input: {
  memberId: string;
  otherMemberId: string;
  otherExists: boolean;
  blocked: boolean;
}): 'ok' | 'self' | 'not_found' | 'blocked' {
  if (input.memberId === input.otherMemberId) return 'self';
  if (!input.otherExists) return 'not_found';
  if (input.blocked) return 'blocked';
  return 'ok';
}

/** Trimmed message text, or null when empty or too long. */
export function normalizeMessageBody(body: unknown): string | null {
  const parsed = MessageBodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

/** Per-member send timestamps. Owned by the server process. */
export type MessageRateState = Map<string, number[]>;

/** Fixed window: at most MESSAGE_RATE_LIMIT sends per member per MESSAGE_RATE_WINDOW_MS. */
export function allowMessageSend(state: MessageRateState, memberId: string, nowMs: number): boolean {
  const windowStart = nowMs - MESSAGE_RATE_WINDOW_MS;
  const recent = (state.get(memberId) ?? []).filter((at) => at > windowStart);
  if (recent.length >= MESSAGE_RATE_LIMIT) {
    state.set(memberId, recent);
    return false;
  }
  recent.push(nowMs);
  state.set(memberId, recent);
  return true;
}

/** Messages from other people that arrived after the member's last read (ISO timestamps compare as text). */
export function countUnread(
  messages: readonly { senderId: string; createdAt: string }[],
  memberId: string,
  lastReadAt: string | null,
): number {
  return messages.filter(
    (message) => message.senderId !== memberId && (lastReadAt === null || message.createdAt > lastReadAt),
  ).length;
}

/**
 * Earliest moment from which an unread message can exist across a member's threads: the oldest of
 * each thread's own cutoff (last read, else when the member joined the thread). Empty when none.
 */
export function unreadFloor(
  threads: readonly { lastReadAt: string | null; since: string }[],
): string {
  let floor = '';
  for (const thread of threads) {
    const at = thread.lastReadAt ?? thread.since;
    if (!floor || at < floor) floor = at;
  }
  return floor;
}

/** One line, whitespace collapsed, for thread lists. */
export function previewOf(body: string, max = 80): string {
  const line = body.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
