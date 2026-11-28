import { type ChatMessage, type ChatThread, type ReportReason } from '@underground/domain';
import { publicEnv } from '../lib/env';
import { getMobileSupabaseClient, isLiveAuthConfigured } from '../session/supabase-session';

export class MessagesError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Short, human wording for the codes the message routes return. */
export function messageText(code: string): string {
  const known: Record<string, string> = {
    not_signed_in: 'Sign in to use messages.',
    chat_needs_live_sign_in: 'Chat needs a live sign-in.',
    forbidden: 'You can’t open this conversation.',
    blocked: 'You can’t message this member.',
    rate_limited: 'You’re sending too quickly. Wait a moment.',
    member_not_found: 'No member with that number.',
    not_a_club_member: 'You’re not a member of this club.',
    cannot_message_self: 'You can’t message yourself.',
    empty_body: 'Type a message first.',
    messages_not_configured: 'Messages aren’t set up yet.',
    messages_unavailable: 'Could not reach messages. Try again.',
  };
  const notSetUp = 'Messages aren’t set up on this server yet.';
  const extra: Record<string, string> = {
    missing_or_invalid_bearer: 'Your sign-in expired. Sign in again.',
    invalid_access_token: 'Your sign-in expired. Sign in again.',
    membership_not_active: 'This membership isn’t active.',
    member_backend_not_configured: notSetUp,
    not_found: notSetUp,
  };
  return (
    extra[code] ??
    known[code] ??
    (code.startsWith('http_') ? notSetUp : 'Could not reach messages. Try again.')
  );
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isLiveAuthConfigured()) throw new MessagesError('chat_needs_live_sign_in');
  const session = await getMobileSupabaseClient()?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new MessagesError('not_signed_in');
  const base = publicEnv.API_PUBLIC_URL!.replace(/\/$/, '');
  const response = await fetch(base + path, {
    ...init,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!response.ok || body.ok === false) throw new MessagesError(body.error ?? `http_${response.status}`);
  return body;
}

export const messagesApi = {
  threads: () => request<{ threads: ChatThread[] }>('/v1/messages/threads'),
  list: (threadId: string) =>
    request<{ messages: ChatMessage[] }>(`/v1/messages/threads/${encodeURIComponent(threadId)}?limit=50`),
  send: (threadId: string, body: string) =>
    request<{ message: ChatMessage }>(`/v1/messages/threads/${encodeURIComponent(threadId)}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  markRead: (threadId: string) =>
    request<{ ok: true }>(`/v1/messages/threads/${encodeURIComponent(threadId)}/read`, {
      method: 'POST',
      body: '{}',
    }),
  openDirect: (withMemberId: string) =>
    request<{ threadId: string }>('/v1/messages/open/direct', {
      method: 'POST',
      body: JSON.stringify({ withMemberId }),
    }),
  openClub: (clubId: string) =>
    request<{ threadId: string }>('/v1/messages/open/club', { method: 'POST', body: JSON.stringify({ clubId }) }),
  block: (memberId: string) =>
    request<{ ok: true }>('/v1/messages/block', { method: 'POST', body: JSON.stringify({ memberId }) }),
  report: (messageId: string, reason: ReportReason) =>
    request<{ ok: true }>('/v1/messages/report', { method: 'POST', body: JSON.stringify({ messageId, reason }) }),
};
