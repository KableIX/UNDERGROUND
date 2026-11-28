begin;

-- Club chat reuses the message tables: one thread per club. Access to a club thread follows live
-- club membership (checked by the API), so it ends the moment membership does.
alter table public.dm_threads
  add column if not exists club_id uuid references public.clubs(id) on delete cascade,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_message_preview text;

create unique index if not exists dm_threads_one_per_club
  on public.dm_threads(club_id) where club_id is not null;
create index if not exists dm_threads_recent
  on public.dm_threads(last_message_at desc nulls last);
create index if not exists dm_messages_thread_recent
  on public.dm_messages(thread_id, created_at desc);
create index if not exists dm_thread_participants_member
  on public.dm_thread_participants(member_id);

-- Every new message keeps its thread's stamp and one-line preview current, whoever inserts it.
create or replace function public.dm_threads_touch()
  returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  update public.dm_threads
     set last_message_at = new.created_at,
         last_message_preview = left(regexp_replace(new.body, '\s+', ' ', 'g'), 160)
   where id = new.thread_id;
  return new;
end;
$$;
revoke execute on function public.dm_threads_touch() from public, anon, authenticated;

drop trigger if exists dm_threads_touch on public.dm_messages;
create trigger dm_threads_touch
  after insert on public.dm_messages
  for each row execute function public.dm_threads_touch();

-- Threads that already hold messages take their stamp and preview from the last one.
update public.dm_threads t
   set last_message_at = m.created_at,
       last_message_preview = left(regexp_replace(m.body, '\s+', ' ', 'g'), 160)
  from (
    select distinct on (thread_id) thread_id, body, created_at
      from public.dm_messages
     order by thread_id, created_at desc, id desc
  ) m
 where m.thread_id = t.id;

-- Read markers drive unread counts.
create table if not exists public.dm_thread_reads (
  thread_id uuid not null references public.dm_threads(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  last_read_at timestamptz not null,
  primary key (thread_id, member_id)
);

-- A member can block another. The API refuses direct messages in both directions between the two.
create table if not exists public.member_blocks (
  blocker_id uuid not null references public.members(id) on delete cascade,
  blocked_id uuid not null references public.members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- A reported message is held for review. It stays visible to its sender and is not deleted automatically.
create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.members(id) on delete cascade,
  message_id uuid not null references public.dm_messages(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'threat', 'doxxing', 'other')),
  created_at timestamptz not null default now(),
  unique (reporter_id, message_id)
);

-- Reading or posting straight to the database follows the same rule as the API: a direct thread is
-- open to the two people in it, and a club thread only while the member still belongs to the club.
-- The helper is security definer so the club-membership check can read dm_threads even though that
-- table has RLS enabled and no select policy of its own (an in-policy subquery would otherwise
-- see zero rows and the check would collapse to allow).
create or replace function public.can_access_chat_thread(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_member_id() is not null
    and exists (
      select 1 from public.dm_thread_participants p
       where p.thread_id = target
         and p.member_id = public.current_member_id()
    )
    and (
      not exists (
        select 1 from public.dm_threads t
         where t.id = target and t.kind = 'club'
      )
      or exists (
        select 1
          from public.dm_threads t
          join public.club_memberships cm on cm.club_id = t.club_id
         where t.id = target
           and t.kind = 'club'
           and cm.member_id = public.current_member_id()
      )
    )
$$;
revoke all on function public.can_access_chat_thread(uuid) from public, anon;
grant execute on function public.can_access_chat_thread(uuid) to authenticated;

drop policy if exists dm_messages_select_participant on public.dm_messages;
create policy dm_messages_select_participant on public.dm_messages
  for select using (public.can_access_chat_thread(thread_id));

drop policy if exists dm_messages_insert_sender on public.dm_messages;
create policy dm_messages_insert_sender on public.dm_messages
  for insert with check (
    sender_id = public.current_member_id()
    and public.can_access_chat_thread(thread_id)
  );

-- Service role only: every read and write goes through the API, which checks membership.
alter table public.dm_thread_reads enable row level security;
alter table public.member_blocks enable row level security;
alter table public.message_reports enable row level security;
revoke all on public.dm_thread_reads, public.member_blocks, public.message_reports
  from public, anon, authenticated;

commit;
