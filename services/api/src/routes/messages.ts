import {
  MESSAGE_PAGE_DEFAULT,
  MESSAGE_PAGE_MAX,
  ReportReasonSchema,
  allowMessageSend,
  normalizeMessageBody,
  type MessageRateState,
} from '@underground/domain';
import { z } from 'zod';
import type { MessagesGateway } from '../messages-gateway';

export type MessagesReply = { status: number; body: unknown };

const UuidSchema = z.string().uuid();
const OpenDirectSchema = z.object({ withMemberId: z.string().uuid() });
const OpenClubSchema = z.object({ clubId: z.string().uuid() });
const BlockSchema = z.object({ memberId: z.string().uuid() });
const ReportSchema = z.object({ messageId: z.string().uuid(), reason: ReportReasonSchema });

export interface MessagesHandlers {
  listThreads(memberId: string): Promise<MessagesReply>;
  listMessages(memberId: string, threadId: string, rawLimit: string | null, rawBefore: string | null): Promise<MessagesReply>;
  sendMessage(memberId: string, threadId: string, raw: unknown): Promise<MessagesReply>;
  markRead(memberId: string, threadId: string): Promise<MessagesReply>;
  openDirect(memberId: string, raw: unknown): Promise<MessagesReply>;
  openClub(memberId: string, raw: unknown): Promise<MessagesReply>;
  block(memberId: string, raw: unknown): Promise<MessagesReply>;
  report(memberId: string, raw: unknown): Promise<MessagesReply>;
}

type OpenResult = Awaited<ReturnType<MessagesGateway['openDirectThread']>>;

/**
 * Message routes for signed-in members. The member id always comes from the verified token;
 * a member id in the request body is never trusted. Replies are plain {status, body} pairs so
 * the HTTP layer stays thin and the rules stay testable without a server.
 */
export function createMessagesHandlers(
  gateway: MessagesGateway | null,
  options: { nowMs?: () => number } = {},
): MessagesHandlers {
  const nowMs = options.nowMs ?? Date.now;
  const sends: MessageRateState = new Map();
  const reply = (status: number, body: unknown): MessagesReply => ({ status, body });
  const fail = (status: number, error: string): MessagesReply => reply(status, { ok: false, error });
  const notConfigured = (): MessagesReply => fail(503, 'messages_not_configured');
  const run = async (task: () => Promise<MessagesReply>): Promise<MessagesReply> => {
    try {
      return await task();
    } catch {
      return fail(502, 'messages_unavailable');
    }
  };
  const opened = (result: OpenResult): MessagesReply => {
    if (result === 'self') return fail(422, 'cannot_message_self');
    if (result === 'not_found') return fail(404, 'member_not_found');
    if (result === 'blocked') return fail(409, 'blocked');
    if (result === 'forbidden') return fail(403, 'not_a_club_member');
    return reply(200, { ok: true, threadId: result.threadId });
  };

  return {
    async listThreads(memberId) {
      if (!gateway) return notConfigured();
      return run(async () => reply(200, { ok: true, threads: await gateway.listThreads(memberId) }));
    },

    async listMessages(memberId, threadId, rawLimit, rawBefore) {
      if (!gateway) return notConfigured();
      if (!UuidSchema.safeParse(threadId).success) return fail(404, 'not_found');
      const requested = Number(rawLimit);
      const limit = Math.min(
        MESSAGE_PAGE_MAX,
        Math.max(1, Number.isFinite(requested) && requested > 0 ? requested : MESSAGE_PAGE_DEFAULT),
      );
      const before = rawBefore && z.string().datetime({ offset: true }).safeParse(rawBefore).success ? rawBefore : null;
      return run(async () => {
        const messages = await gateway.listMessages(memberId, threadId, limit, before);
        return messages === 'forbidden' ? fail(403, 'forbidden') : reply(200, { ok: true, messages });
      });
    },

    async sendMessage(memberId, threadId, raw) {
      if (!gateway) return notConfigured();
      if (!UuidSchema.safeParse(threadId).success) return fail(404, 'not_found');
      const parsed = z.object({ body: z.string() }).safeParse(raw);
      const body = parsed.success ? normalizeMessageBody(parsed.data.body) : null;
      if (body === null) return fail(422, 'empty_body');
      if (!allowMessageSend(sends, memberId, nowMs())) return fail(429, 'rate_limited');
      return run(async () => {
        const message = await gateway.sendMessage(memberId, threadId, body);
        if (message === 'forbidden') return fail(403, 'forbidden');
        if (message === 'blocked') return fail(409, 'blocked');
        return reply(201, { ok: true, message });
      });
    },

    async markRead(memberId, threadId) {
      if (!gateway) return notConfigured();
      if (!UuidSchema.safeParse(threadId).success) return fail(404, 'not_found');
      return run(async () => {
        await gateway.markRead(memberId, threadId);
        return reply(200, { ok: true });
      });
    },

    async openDirect(memberId, raw) {
      if (!gateway) return notConfigured();
      const parsed = OpenDirectSchema.safeParse(raw);
      if (!parsed.success) return fail(400, 'invalid_request');
      return run(async () => opened(await gateway.openDirectThread(memberId, parsed.data.withMemberId)));
    },

    async openClub(memberId, raw) {
      if (!gateway) return notConfigured();
      const parsed = OpenClubSchema.safeParse(raw);
      if (!parsed.success) return fail(400, 'invalid_request');
      return run(async () => opened(await gateway.openClubThread(memberId, parsed.data.clubId)));
    },

    async block(memberId, raw) {
      if (!gateway) return notConfigured();
      const parsed = BlockSchema.safeParse(raw);
      if (!parsed.success) return fail(400, 'invalid_request');
      if (parsed.data.memberId === memberId) return fail(422, 'cannot_block_self');
      return run(async () => {
        await gateway.blockMember(memberId, parsed.data.memberId);
        return reply(200, { ok: true });
      });
    },

    async report(memberId, raw) {
      if (!gateway) return notConfigured();
      const parsed = ReportSchema.safeParse(raw);
      if (!parsed.success) return fail(400, 'invalid_request');
      return run(async () =>
        (await gateway.reportMessage(memberId, parsed.data.messageId, parsed.data.reason)) === 'not_found'
          ? fail(404, 'message_not_found')
          : reply(200, { ok: true }),
      );
    },
  };
}
