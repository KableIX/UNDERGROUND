import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  canUseThread,
  countUnread,
  previewOf,
  unreadFloor,
  type ChatMessage,
  type ChatThread,
} from '@underground/domain';
import type { RuntimeEnv } from './env';

type ThreadRow = {
  id: string;
  kind: string;
  club_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  dm_thread_participants: { member_id: string }[];
  clubs: { id: string; name: string } | null;
};
type ParticipantRow = {
  thread_id: string;
  member_id: string;
  members: { display_name: string; member_number: string } | null;
};
type MessageRow = { id: string; thread_id: string; sender_id: string; body: string; created_at: string };

export type OpenThreadResult = { threadId: string } | 'not_found' | 'blocked' | 'self' | 'forbidden';

/**
 * Member-scoped message storage. Only the backend builds this (service role). The API checks
 * access on every call, so club chat ends with membership and blocks stop direct messages.
 */
export interface MessagesGateway {
  listThreads(memberId: string): Promise<ChatThread[]>;
  listMessages(
    memberId: string,
    threadId: string,
    limit: number,
    before: string | null,
  ): Promise<ChatMessage[] | 'forbidden'>;
  sendMessage(memberId: string, threadId: string, body: string): Promise<ChatMessage | 'forbidden' | 'blocked'>;
  openDirectThread(memberId: string, otherMemberId: string): Promise<OpenThreadResult>;
  openClubThread(memberId: string, clubId: string): Promise<OpenThreadResult>;
  markRead(memberId: string, threadId: string): Promise<void>;
  blockMember(memberId: string, blockedId: string): Promise<void>;
  reportMessage(memberId: string, messageId: string, reason: string): Promise<'ok' | 'not_found'>;
}

function unavailable(code: string): never {
  throw new Error(code);
}

export function createSupabaseMessagesGateway(env: RuntimeEnv): MessagesGateway | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin: SupabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  async function displayNamesFor(memberIds: readonly string[]): Promise<Map<string, string>> {
    if (!memberIds.length) return new Map();
    const { data, error } = await admin.from('members').select('id, display_name').in('id', [...memberIds]);
    if (error) return unavailable('member_lookup_unavailable');
    return new Map((data ?? []).map((row) => [row.id as string, (row.display_name as string) || 'Member']));
  }

  async function clubIdsFor(memberId: string): Promise<string[]> {
    const { data, error } = await admin.from('club_memberships').select('club_id').eq('member_id', memberId);
    if (error) return unavailable('club_lookup_unavailable');
    return (data ?? []).map((row) => row.club_id as string);
  }

  async function threadFor(threadId: string): Promise<ThreadRow | null> {
    const { data, error } = await admin
      .from('dm_threads')
      .select('id, kind, club_id, last_message_at, dm_thread_participants(member_id), clubs(id, name)')
      .eq('id', threadId)
      .maybeSingle();
    if (error) return unavailable('thread_lookup_unavailable');
    return (data as unknown as ThreadRow | null) ?? null;
  }

  /** Live check: participants for direct threads, current club membership for club threads. */
  async function canUse(thread: ThreadRow, memberId: string): Promise<boolean> {
    const clubMemberIds = thread.kind === 'club' ? await clubIdsFor(memberId) : [];
    return canUseThread(
      {
        kind: thread.kind,
        clubId: thread.club_id,
        participantIds: (thread.dm_thread_participants ?? []).map((person) => person.member_id),
      },
      memberId,
      clubMemberIds,
    );
  }

  async function blockedBetween(a: string, b: string): Promise<boolean> {
    const [forward, reverse] = await Promise.all([
      admin.from('member_blocks').select('blocker_id').eq('blocker_id', a).eq('blocked_id', b).maybeSingle(),
      admin.from('member_blocks').select('blocker_id').eq('blocker_id', b).eq('blocked_id', a).maybeSingle(),
    ]);
    if (forward.error || reverse.error) return unavailable('block_lookup_unavailable');
    return Boolean(forward.data) || Boolean(reverse.data);
  }

  async function insertParticipant(threadId: string, memberId: string): Promise<void> {
    const { error } = await admin
      .from('dm_thread_participants')
      .insert({ thread_id: threadId, member_id: memberId });
    if (error && error.code !== '23505') return unavailable('participant_write_unavailable');
  }

  return {
    async listThreads(memberId) {
      const { data: mine, error: mineError } = await admin
        .from('dm_thread_participants')
        .select('thread_id, joined_at')
        .eq('member_id', memberId);
      if (mineError) return unavailable('thread_lookup_unavailable');
      const joinedAt = new Map<string, string>(
        (mine ?? []).map((row) => [row.thread_id as string, row.joined_at as string]),
      );
      const ids = [...joinedAt.keys()];
      if (!ids.length) return [];
      const [threadResult, peopleResult, readResult, clubResult] = await Promise.all([
        admin
          .from('dm_threads')
          .select(
            'id, kind, club_id, last_message_at, last_message_preview, dm_thread_participants(member_id), clubs(id, name)',
          )
          .in('id', ids)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(100),
        admin
          .from('dm_thread_participants')
          .select('thread_id, member_id, members(display_name, member_number)')
          .in('thread_id', ids),
        admin.from('dm_thread_reads').select('thread_id, last_read_at').eq('member_id', memberId),
        admin.from('club_memberships').select('club_id').eq('member_id', memberId),
      ]);
      if (threadResult.error || peopleResult.error || readResult.error || clubResult.error) {
        return unavailable('thread_lookup_unavailable');
      }
      const myClubs = new Set(
        ((clubResult.data ?? []) as { club_id: string }[]).map((row) => row.club_id),
      );
      // A club the member has left is not theirs to see, even as a row in the list.
      const rows = ((threadResult.data ?? []) as unknown as ThreadRow[]).filter(
        (thread) => thread.kind !== 'club' || myClubs.has(thread.club_id ?? ''),
      );
      const shown = new Set(rows.map((thread) => thread.id));
      const lastRead = new Map<string, string>(
        ((readResult.data ?? []) as { thread_id: string; last_read_at: string }[]).map((row) => [
          row.thread_id,
          row.last_read_at,
        ]),
      );
      const peopleOf = new Map<string, ParticipantRow[]>();
      for (const person of (peopleResult.data ?? []) as unknown as ParticipantRow[]) {
        if (!shown.has(person.thread_id)) continue;
        const list = peopleOf.get(person.thread_id) ?? [];
        list.push(person);
        peopleOf.set(person.thread_id, list);
      }
      // Unread means from someone else, after this member's own cutoff in that thread.
      const messagesOf = new Map<string, { senderId: string; createdAt: string }[]>();
      const floor = unreadFloor(
        rows.map((thread) => ({
          lastReadAt: lastRead.get(thread.id) ?? null,
          since: joinedAt.get(thread.id) ?? '',
        })),
      );
      if (shown.size) {
        let recentQuery = admin
          .from('dm_messages')
          .select('thread_id, sender_id, created_at')
          .in('thread_id', [...shown])
          .neq('sender_id', memberId);
        if (floor) recentQuery = recentQuery.gt('created_at', floor);
        const { data: recent, error: recentError } = await recentQuery
          .order('created_at', { ascending: false })
          .limit(2000);
        if (recentError) return unavailable('thread_lookup_unavailable');
        for (const message of (recent ?? []) as MessageRow[]) {
          const list = messagesOf.get(message.thread_id) ?? [];
          list.push({ senderId: message.sender_id, createdAt: message.created_at });
          messagesOf.set(message.thread_id, list);
        }
      }
      return rows.map((thread): ChatThread => {
        const people = peopleOf.get(thread.id) ?? [];
        const other = people.find((person) => person.member_id !== memberId);
        const isClub = thread.kind === 'club';
        return {
          id: thread.id,
          kind: isClub ? 'club' : 'direct',
          clubId: thread.club_id,
          title: isClub ? thread.clubs?.name ?? 'Club' : other?.members?.display_name ?? 'Member',
          memberNumber: isClub ? null : other?.members?.member_number ?? null,
          lastMessageAt: thread.last_message_at,
          lastMessagePreview: thread.last_message_preview ? previewOf(thread.last_message_preview) : null,
          unreadCount: countUnread(
            messagesOf.get(thread.id) ?? [],
            memberId,
            lastRead.get(thread.id) ?? joinedAt.get(thread.id) ?? null,
          ),
          participantIds: people.map((person) => person.member_id),
        };
      });
    },

    async listMessages(memberId, threadId, limit, before) {
      const thread = await threadFor(threadId);
      if (!thread || !(await canUse(thread, memberId))) return 'forbidden';
      let query = admin
        .from('dm_messages')
        .select('id, thread_id, sender_id, body, created_at')
        .eq('thread_id', threadId);
      if (before) query = query.lt('created_at', before);
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
      if (error) return unavailable('message_lookup_unavailable');
      // Newest first from the database; a conversation reads bottom-up, so reverse once.
      const messages = ((data ?? []) as MessageRow[]).reverse();
      const names = await displayNamesFor([...new Set(messages.map((message) => message.sender_id))]);
      return messages.map((message): ChatMessage => ({
        id: message.id,
        threadId: message.thread_id,
        senderId: message.sender_id,
        senderName: names.get(message.sender_id) ?? 'Member',
        body: message.body,
        createdAt: message.created_at,
      }));
    },

    async sendMessage(memberId, threadId, body) {
      const thread = await threadFor(threadId);
      if (!thread || !(await canUse(thread, memberId))) return 'forbidden';
      if (thread.kind !== 'club') {
        const otherId = (thread.dm_thread_participants ?? [])
          .map((person) => person.member_id)
          .find((id) => id !== memberId);
        if (otherId && (await blockedBetween(memberId, otherId))) return 'blocked';
      }
      const { data, error } = await admin
        .from('dm_messages')
        .insert({ thread_id: threadId, sender_id: memberId, body })
        .select('id, thread_id, sender_id, body, created_at')
        .single();
      if (error) return unavailable('message_write_unavailable');
      const message = data as unknown as MessageRow;
      // The sender has read their own message. The database keeps the thread's stamp and preview.
      const [names, readUpdate] = await Promise.all([
        displayNamesFor([memberId]),
        admin
          .from('dm_thread_reads')
          .upsert({ thread_id: threadId, member_id: memberId, last_read_at: message.created_at })
          .select('thread_id'),
      ]);
      if (readUpdate.error) return unavailable('message_write_unavailable');
      return {
        id: message.id,
        threadId: message.thread_id,
        senderId: message.sender_id,
        senderName: names.get(memberId) ?? 'Member',
        body: message.body,
        createdAt: message.created_at,
      };
    },

    async openDirectThread(memberId, otherMemberId) {
      if (memberId === otherMemberId) return 'self';
      const { data: other, error: otherError } = await admin
        .from('members')
        .select('id')
        .eq('id', otherMemberId)
        .maybeSingle();
      if (otherError) return unavailable('member_lookup_unavailable');
      if (!other) return 'not_found';
      if (await blockedBetween(memberId, otherMemberId)) return 'blocked';
      // Reuse the direct thread that already holds exactly these two people.
      const { data: mine, error: mineError } = await admin
        .from('dm_thread_participants')
        .select('thread_id, dm_threads!inner(kind)')
        .eq('member_id', memberId)
        .eq('dm_threads.kind', 'direct');
      if (mineError) return unavailable('thread_lookup_unavailable');
      const candidates = (mine ?? []).map((row) => row.thread_id as string);
      if (candidates.length) {
        const { data: people, error: peopleError } = await admin
          .from('dm_thread_participants')
          .select('thread_id, member_id')
          .in('thread_id', candidates);
        if (peopleError) return unavailable('thread_lookup_unavailable');
        const membersOf = new Map<string, Set<string>>();
        for (const row of people ?? []) {
          const members = membersOf.get(row.thread_id as string) ?? new Set<string>();
          members.add(row.member_id as string);
          membersOf.set(row.thread_id as string, members);
        }
        for (const [threadId, members] of membersOf) {
          if (members.size === 2 && members.has(memberId) && members.has(otherMemberId)) return { threadId };
        }
      }
      const { data: created, error: createError } = await admin
        .from('dm_threads')
        .insert({ kind: 'direct' })
        .select('id')
        .single();
      if (createError) return unavailable('thread_create_unavailable');
      const threadId = created.id as string;
      await insertParticipant(threadId, memberId);
      await insertParticipant(threadId, otherMemberId);
      return { threadId };
    },

    async openClubThread(memberId, clubId) {
      if (!(await clubIdsFor(memberId)).includes(clubId)) return 'forbidden';
      const { data: existing, error: existingError } = await admin
        .from('dm_threads')
        .select('id')
        .eq('club_id', clubId)
        .maybeSingle();
      if (existingError) return unavailable('thread_lookup_unavailable');
      let threadId = existing?.id as string | undefined;
      if (!threadId) {
        const { data: created, error: createError } = await admin
          .from('dm_threads')
          .insert({ kind: 'club', club_id: clubId })
          .select('id')
          .single();
        if (createError) return unavailable('thread_create_unavailable');
        threadId = created.id as string;
      }
      await insertParticipant(threadId, memberId);
      return { threadId };
    },

    async markRead(memberId, threadId) {
      const thread = await threadFor(threadId);
      // No access means there is nothing to mark; the caller learns nothing about the thread.
      if (!thread || !(await canUse(thread, memberId))) return;
      const { error } = await admin
        .from('dm_thread_reads')
        .upsert({ thread_id: threadId, member_id: memberId, last_read_at: new Date().toISOString() });
      if (error) return unavailable('read_marker_unavailable');
    },

    async blockMember(memberId, blockedId) {
      const { error } = await admin
        .from('member_blocks')
        .insert({ blocker_id: memberId, blocked_id: blockedId });
      if (error && error.code !== '23505') return unavailable('block_write_unavailable');
    },

    async reportMessage(memberId, messageId, reason) {
      const { data: message, error: messageError } = await admin
        .from('dm_messages')
        .select('id')
        .eq('id', messageId)
        .maybeSingle();
      if (messageError) return unavailable('message_lookup_unavailable');
      if (!message) return 'not_found';
      const { error } = await admin
        .from('message_reports')
        .insert({ reporter_id: memberId, message_id: messageId, reason });
      if (error && error.code !== '23505') return unavailable('report_write_unavailable');
      return 'ok';
    },
  };
}
