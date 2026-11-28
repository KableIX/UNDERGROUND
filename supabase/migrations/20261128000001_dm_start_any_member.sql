begin;

-- Resolve a member by number to start a one-on-one DM. Any signed-in member may look up
-- any other member this way; profile page visibility is not required. The API still
-- refuses self-DMs and honors blocks. Message read and write stay participant-only.
create or replace function public.find_member_for_message(number_input text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id
    from public.members m
   where number_input ~ '^[0-9]{6}$'
     and m.member_number = number_input
     and public.current_member_id() is not null
$$;

revoke all on function public.find_member_for_message(text) from public, anon;
grant execute on function public.find_member_for_message(text) to authenticated;

-- True when the signed-in member may start a direct thread with the target: the target
-- is a different existing member, and neither person has blocked the other.
create or replace function public.can_start_direct_with(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.current_member_id() is not null
    and target is not null
    and target <> public.current_member_id()
    and exists (select 1 from public.members m where m.id = target)
    and not exists (
      select 1 from public.member_blocks b
       where (b.blocker_id = public.current_member_id() and b.blocked_id = target)
          or (b.blocker_id = target and b.blocked_id = public.current_member_id())
    )
$$;

revoke all on function public.can_start_direct_with(uuid) from public, anon;
grant execute on function public.can_start_direct_with(uuid) to authenticated;

comment on function public.find_member_for_message(text) is
  'Look up any member by number for DM start. Does not require a visible profile page.';
comment on function public.can_start_direct_with(uuid) is
  'Whether the signed-in member may start a one-on-one DM with the target. Visibility is not required.';

commit;
