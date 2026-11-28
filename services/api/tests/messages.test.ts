import { describe, expect, it } from 'vitest';
import { MESSAGE_RATE_LIMIT, type ChatMessage } from '@underground/domain';
import type { MessagesGateway } from '../src/messages-gateway';
import { createMessagesHandlers } from '../src/routes/messages';

const me = '11111111-1111-4111-8111-111111111111';
const friend = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333';
const thread = '44444444-4444-4444-8444-444444444444';
const hello: ChatMessage = {
  id: '55555555-5555-4555-8555-555555555555',
  threadId: thread,
  senderId: friend,
  senderName: 'Friend',
  body: 'Hello',
  createdAt: '2026-11-27T10:00:00.000+00:00',
};

/** In-memory stand-in for the database. It records what the rules let through. */
function fakeGateway() {
  const state = {
    participants: new Set([me, friend]),
    clubMembers: new Set([me]),
    blocked: new Set<string>(),
    sent: [] as string[],
    reported: [] as string[],
  };
  const gateway: MessagesGateway = {
    async listThreads(memberId) {
      return state.participants.has(memberId)
        ? [{
            id: thread, kind: 'direct', clubId: null, title: 'Friend', memberNumber: '000002',
            lastMessageAt: hello.createdAt, lastMessagePreview: 'Hello', unreadCount: 1,
            participantIds: [me, friend],
          }]
        : [];
    },
    async listMessages(memberId, threadId, limit) {
      if (threadId !== thread || !state.participants.has(memberId)) return 'forbidden';
      return [hello].slice(-limit);
    },
    async sendMessage(memberId, threadId, body) {
      if (threadId !== thread || !state.participants.has(memberId)) return 'forbidden';
      if (state.blocked.has(memberId)) return 'blocked';
      state.sent.push(body);
      return { ...hello, senderId: memberId, body };
    },
    async openDirectThread(memberId, other) {
      if (other === me) return 'self';
      if (other === outsider) return 'not_found';
      return { threadId: thread };
    },
    async openClubThread(memberId) {
      return state.clubMembers.has(memberId) ? { threadId: thread } : 'forbidden';
    },
    async markRead() {},
    async blockMember(memberId, blockedId) {
      state.blocked.add(blockedId);
    },
    async reportMessage(memberId, messageId) {
      state.reported.push(messageId);
      return messageId === hello.id ? 'ok' : 'not_found';
    },
  };
  return { gateway, state };
}

const clock = () => 1_000_000;

describe('message routes', () => {
  it('answers 503 when no message store is configured', async () => {
    const handlers = createMessagesHandlers(null);
    expect((await handlers.listThreads(me)).status).toBe(503);
    expect((await handlers.sendMessage(me, thread, { body: 'hi' })).status).toBe(503);
  });

  it('turns a store failure into 502 without leaking details', async () => {
    const handlers = createMessagesHandlers({
      ...fakeGateway().gateway,
      async listThreads() {
        throw new Error('password=hunter2');
      },
    });
    const reply = await handlers.listThreads(me);
    expect(reply.status).toBe(502);
    expect(JSON.stringify(reply.body)).not.toContain('hunter2');
  });

  it('lists threads and messages only for a participant', async () => {
    const { gateway } = fakeGateway();
    const handlers = createMessagesHandlers(gateway);
    const threads = await handlers.listThreads(me);
    expect(threads.status).toBe(200);
    expect((threads.body as { threads: { unreadCount: number }[] }).threads[0]?.unreadCount).toBe(1);
    expect((await handlers.listMessages(me, thread, null, null)).status).toBe(200);
    expect((await handlers.listMessages(outsider, thread, null, null)).status).toBe(403);
    expect((await handlers.listMessages(me, 'not-a-uuid', null, null)).status).toBe(404);
  });

  it('sends a trimmed message, and refuses empty or non-text bodies', async () => {
    const { gateway, state } = fakeGateway();
    const handlers = createMessagesHandlers(gateway, { nowMs: clock });
    const sent = await handlers.sendMessage(me, thread, { body: '  See you at the meet  ' });
    expect(sent.status).toBe(201);
    expect(state.sent).toEqual(['See you at the meet']);
    expect((await handlers.sendMessage(me, thread, { body: '   ' })).status).toBe(422);
    expect((await handlers.sendMessage(me, thread, { body: 42 })).status).toBe(422);
    expect((await handlers.sendMessage(outsider, thread, { body: 'hi' })).status).toBe(403);
  });

  it('stops a member who sends too fast', async () => {
    const { gateway } = fakeGateway();
    const handlers = createMessagesHandlers(gateway, { nowMs: clock });
    let last = 0;
    for (let i = 0; i < MESSAGE_RATE_LIMIT; i += 1) {
      last = (await handlers.sendMessage(me, thread, { body: `m${i}` })).status;
    }
    expect(last).toBe(201);
    expect((await handlers.sendMessage(me, thread, { body: 'one more' })).status).toBe(429);
  });

  it('reports a blocked direct thread as 409', async () => {
    const { gateway, state } = fakeGateway();
    const handlers = createMessagesHandlers(gateway, { nowMs: clock });
    state.blocked.add(me);
    expect((await handlers.sendMessage(me, thread, { body: 'hi' })).status).toBe(409);
  });

  it('opens a direct thread, and refuses yourself, unknown members and bad input', async () => {
    const handlers = createMessagesHandlers(fakeGateway().gateway);
    const opened = await handlers.openDirect(me, { withMemberId: friend });
    expect(opened.status).toBe(200);
    expect((opened.body as { threadId: string }).threadId).toBe(thread);
    expect((await handlers.openDirect(me, { withMemberId: me })).status).toBe(422);
    expect((await handlers.openDirect(me, { withMemberId: outsider })).status).toBe(404);
    expect((await handlers.openDirect(me, { memberId: friend })).status).toBe(400);
  });

  it('opens club chat only for club members', async () => {
    const { gateway } = fakeGateway();
    const handlers = createMessagesHandlers(gateway);
    expect((await handlers.openClub(me, { clubId: thread })).status).toBe(200);
    expect((await handlers.openClub(outsider, { clubId: thread })).status).toBe(403);
    expect((await handlers.openClub(me, { clubId: 'nope' })).status).toBe(400);
  });

  it('marks a thread read and refuses to block yourself', async () => {
    const { gateway } = fakeGateway();
    const handlers = createMessagesHandlers(gateway);
    expect((await handlers.markRead(me, thread)).status).toBe(200);
    expect((await handlers.block(me, { memberId: friend })).status).toBe(200);
    expect((await handlers.block(me, { memberId: me })).status).toBe(422);
  });

  it('takes a report with a known reason, and 404s for a missing message', async () => {
    const { gateway, state } = fakeGateway();
    const handlers = createMessagesHandlers(gateway);
    expect((await handlers.report(me, { messageId: hello.id, reason: 'harassment' })).status).toBe(200);
    expect(state.reported).toEqual([hello.id]);
    expect((await handlers.report(me, { messageId: thread, reason: 'spam' })).status).toBe(404);
    expect((await handlers.report(me, { messageId: hello.id, reason: 'because' })).status).toBe(400);
  });
});
