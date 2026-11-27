begin;
alter table public.clubs add column badge text not null default '', add column home_territory text not null default '';
create table public.club_access (
 id uuid primary key default gen_random_uuid(),
 email text not null,
 issuer uuid not null references public.members(id),
 purpose text not null check(purpose in ('lead','roster')),
 club_id uuid references public.clubs(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '14 days',
 outcome text not null default 'pending' check(outcome in ('pending','accepted','declined','expired')),
 check(purpose='lead' or club_id is not null)
);
create unique index club_access_lead on public.club_access(email) where purpose='lead' and outcome='pending';
create unique index club_access_roster on public.club_access(email,club_id) where purpose='roster' and outcome='pending';
alter table public.club_access enable row level security;
revoke all on public.club_access from public,anon,authenticated;

create function public.club_email() returns text language sql stable security definer set search_path='' as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null
$$;

create function public.grant_club_access(recipient text, target uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare m uuid:=public.current_member_id(); e text:=lower(trim(recipient)); ticket uuid;
begin
 if m is null then raise exception 'Sign in first'; end if;
 if target is null then
   if not exists(select from public.members where id=m and (role='admin' or is_founder)) then raise exception 'Club grant permission required'; end if;
 elsif not exists(select from public.club_memberships where club_id=target and member_id=m and role in ('owner','officer')) then raise exception 'Club officer required'; end if;
 if e is null or length(e)>254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email'; end if;
 perform pg_advisory_xact_lock(hashtextextended(e,741));
 if target is not null and exists(select from public.club_memberships cm join public.members mb on mb.id=cm.member_id join auth.users u on u.id=mb.auth_user_id where cm.club_id=target and lower(u.email)=e) then raise exception 'Already on the roster'; end if;
 update public.club_access set outcome='expired' where outcome='pending' and email=e and expires_at<=now();
 select id into ticket from public.club_access where email=e and outcome='pending' and club_id is not distinct from target;
 if not found then
   insert into public.club_access(email,issuer,purpose,club_id) values(e,m,case when target is null then 'lead' else 'roster' end,target) returning id into ticket;
 end if;
 return ticket;
end $$;

-- Only a confirmed identity with an outstanding invitation may obtain a new membership.
create function public.activate_club_invitee() returns void language plpgsql security definer set search_path='' as $$
declare e text:=public.club_email(); n integer; m uuid;
begin
 if public.current_member_id() is not null then return; end if;
 perform pg_advisory_xact_lock(784194131);
 if public.current_member_id() is not null then return; end if;
 if not exists(select from public.club_access where email=e and expires_at>now() and outcome='pending') then raise exception 'No active invitation for this email'; end if;
 select greatest(1,coalesce(max(member_number::integer),0))+1 into n from public.members;
 if n>999999 then raise exception 'Member numbers exhausted'; end if;
 insert into public.members(auth_user_id,member_number,display_name) values(auth.uid(),lpad(n::text,6,'0'),'Member '||lpad(n::text,6,'0')) returning id into m;
 insert into public.profiles(member_id) values(m) on conflict do nothing;
end $$;

create function public.my_club_hub() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('invites',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'purpose',a.purpose,'name',c.name) order by a.expires_at)
 from public.club_access a left join public.clubs c on c.id=a.club_id where a.email=public.club_email() and a.outcome='pending' and a.expires_at>now()),'[]'::jsonb),
 'clubs',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'badge',c.badge,'territory',c.home_territory,'role',cm.role,'roster',
 (select jsonb_agg(jsonb_build_object('name',m.display_name,'role',r.role,'number',m.member_number) order by r.joined_at,m.id) from public.club_memberships r join public.members m on m.id=r.member_id where r.club_id=c.id)) order by c.name)
 from public.club_memberships cm join public.clubs c on c.id=cm.club_id where cm.member_id=public.current_member_id()),'[]'::jsonb),
 'verified',exists(select from public.vehicles where owner_member_id=public.current_member_id() and verification_status='verified'))
$$;

create function public.answer_club_access(ticket uuid, accept boolean, club_name text default '', territory text default '', emblem text default '', market public.founding_market default 'california')
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.club_access; m uuid:=public.current_member_id(); c uuid;
begin
 select * into a from public.club_access where id=ticket and email=public.club_email() for update;
 if not found or m is null or accept is null then raise exception 'Invitation unavailable'; end if;
 if a.outcome='accepted' and accept then return a.club_id; end if;
 if a.outcome='declined' and not accept then return null; end if;
 if a.outcome<>'pending' or a.expires_at<=now() then raise exception 'Invitation unavailable'; end if;
 if not accept then update public.club_access set outcome='declined' where id=ticket;return null;end if;
 if a.purpose='lead' then
  if coalesce(length(trim(club_name)),0) not between 2 and 64 or coalesce(length(trim(territory)),0) not between 2 and 80 or coalesce(length(trim(emblem)),0) not between 1 and 6 then raise exception 'Enter a club name, home territory and short badge'; end if;
  c:=gen_random_uuid();
  insert into public.clubs(id,slug,name,founding_market,created_by_member_id,badge,home_territory)
   values(c,'club-'||c,trim(club_name),market,m,upper(trim(emblem)),trim(territory));
  insert into public.club_memberships(club_id,member_id,role) values(c,m,'owner');
  insert into public.drive_verified_clubs(club_id) values(c);
 else
  if not exists(select from public.vehicles where owner_member_id=m and verification_status='verified') then raise exception 'Vehicle verification required'; end if;
  c:=a.club_id;
  insert into public.club_memberships(club_id,member_id) values(c,m) on conflict(club_id,member_id) do nothing;
 end if;
 update public.club_access set outcome='accepted',club_id=c where id=ticket;
 return c;
end $$;

revoke all on function public.club_email(),public.activate_club_invitee(),public.my_club_hub(),public.grant_club_access(text,uuid),public.answer_club_access(uuid,boolean,text,text,text,public.founding_market) from public,anon;
grant execute on function public.activate_club_invitee(),public.my_club_hub(),public.grant_club_access(text,uuid),public.answer_club_access(uuid,boolean,text,text,text,public.founding_market) to authenticated;
commit;
