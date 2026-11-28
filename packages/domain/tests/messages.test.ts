import { describe, expect, it } from 'vitest';
import {
  MESSAGE_BODY_MAX,
  MESSAGE_RATE_LIMIT,
  allowMessageSend,
  canUseThread,
  countUnread,
  normalizeMessageBody,
  previewOf,
  unreadFloor,
  type MessageRateState,
} from '../src/messages';

const me = 'member-a';
const friend = 'member-b';
const outsider = 'member-c';

describe('message threads', () => {
  it('lets direct-thread participants in and keeps everyone else out', () => {
    const thread = { kind: 'direct', clubId: null, participantIds: [me, friend] };
    expect(canUseThread(thread, me, [])).toBe(true);
    expect(canUseThread(thread, outsider, [])).toBe(false);
  });

  it('follows live club membership for club threads, not the participant list', () => {
    const thread = { kind: 'club', clubId: 'club-1', participantIds: [me] };
    expect(canUseThread(thread, friend, [friend])).toBe(true);
    expect(canUseThread(thread, me, [friend])).toBe(false);
    expect(canUseThread({ ...thread, clubId: null }, me, [me])).toBe(false);
  });
});

describe('message body', () => {
  it('trims and rejects empty or oversized text', () => {
    expect(normalizeMessageBody('  hi there  ')).toBe('hi there');
    expect(normalizeMessageBody('   ')).toBeNull();
    expect(normalizeMessageBody('x'.repeat(MESSAGE_BODY_MAX + 1))).toBeNull();
    expect(normalizeMessageBody(undefined)).toBeNull();
  });

  it('makes a single-line preview', () => {
    expect(previewOf('  hello\n\n there  ')).toBe('hello there');
    expect(previewOf('a'.repeat(100), 10)).toHaveLength(10);
  });
});

describe('message rate limit', () => {
  it('allows the limit inside one window, then refuses until the window passes', () => {
    const state: MessageRateState = new Map();
    const start = 1_000_000;
    for (let i = 0; i < MESSAGE_RATE_LIMIT; i += 1) {
      expect(allowMessageSend(state, me, start + i)).toBe(true);
    }
    expect(allowMessageSend(state, me, start + MESSAGE_RATE_LIMIT)).toBe(false);
    // Another member has their own allowance.
    expect(allowMessageSend(state, friend, start + MESSAGE_RATE_LIMIT)).toBe(true);
    // Old sends fall out of the window.
    expect(allowMessageSend(state, me, start + 60_001)).toBe(true);
  });
});

describe('unread count', () => {
  it('counts only other people\'s messages newer than the last read', () => {
    const messages = [
      { senderId: friend, createdAt: '2026-11-27T10:00:00+00:00' },
      { senderId: me, createdAt: '2026-11-27T10:01:00+00:00' },
      { senderId: friend, createdAt: '2026-11-27T10:02:00+00:00' },
    ];
    expect(countUnread(messages, me, null)).toBe(2);
    expect(countUnread(messages, me, '2026-11-27T10:00:30+00:00')).toBe(1);
    expect(countUnread(messages, me, '2026-11-27T11:00:00+00:00')).toBe(0);
  });
});

describe('unread floor', () => {
  it('takes the oldest cutoff across threads, falling back to when the member joined', () => {
    expect(unreadFloor([])).toBe('');
    expect(
      unreadFloor([
        { lastReadAt: '2026-11-27T10:00:00+00:00', since: '2026-11-20T09:00:00+00:00' },
        { lastReadAt: null, since: '2026-11-21T09:00:00+00:00' },
        { lastReadAt: '2026-11-26T10:00:00+00:00', since: '2026-11-01T09:00:00+00:00' },
      ]),
    ).toBe('2026-11-21T09:00:00+00:00');
  });
});
