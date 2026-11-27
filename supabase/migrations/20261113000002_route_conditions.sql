begin;
create table public.route_conditions (
  id uuid primary key default gen_random_uuid(),
  route text not null check(length(route) between 1 and 160),
  kind text not null check(kind in ('traffic_control','crash','hazard','closure')),
  meters integer not null check(meters between 0 and 3000000),
  longitude double precision not null check(longitude between -180 and 180),
  latitude double precision not null check(latitude between -90 and 90),
  reporter uuid references public.members(id) on delete set null,
  reported_at timestamptz not null default now(),
  confirmed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 minutes'
);
create index route_conditions_active on public.route_conditions(route,expires_at);
create index route_conditions_by_reporter on public.route_conditions(reporter,reported_at);
create table public.route_condition_votes (
  report uuid not null references public.route_conditions(id) on delete cascade,
  member uuid not null references public.members(id) on delete cascade,
  present boolean not null,
  voted_at timestamptz not null default now(),
  primary key(report,member)
);
alter table public.route_conditions enable row level security;
alter table public.route_condition_votes enable row level security;
revoke all on public.route_conditions,public.route_condition_votes from public,anon,authenticated;

create function public.report_route_condition(slug text, category text, at_meters integer, lon double precision, lat double precision)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid := public.current_member_id(); result uuid;
begin
  if actor is null then raise exception 'Membership required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
  perform pg_advisory_xact_lock(hashtextextended(slug,2));
  select id into result from public.route_conditions
    where route=slug and kind=category and expires_at>now() and abs(meters::bigint-at_meters)<80
    order by abs(meters::bigint-at_meters) limit 1;
  if found then return result; end if;
  if exists(select from public.route_conditions where reporter=actor and reported_at>now()-interval '1 minute') then
    raise exception 'Please wait a minute between reports';
  end if;
  insert into public.route_conditions(route,kind,meters,longitude,latitude,reporter)
    values(slug,category,at_meters,lon,lat,actor) returning id into result;
  return result;
end $$;

create function public.verify_route_condition(target uuid, still_present boolean, lon double precision, lat double precision)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid := public.current_member_id(); r public.route_conditions; negatives integer;
begin
  if actor is null then raise exception 'Membership required'; end if;
  select * into r from public.route_conditions where id=target for update;
  if not found or r.expires_at<=now() then raise exception 'Report expired'; end if;
  if actor=r.reporter then raise exception 'Another member must verify'; end if;
  if lon is null or lat is null or lon not between -180 and 180 or lat not between -90 and 90 or
    ((lon-r.longitude)*cos(radians(r.latitude))*111320)^2+((lat-r.latitude)*111320)^2>250^2 then
    raise exception 'Verify near the reported location';
  end if;
  insert into public.route_condition_votes as v(report,member,present) values(target,actor,still_present)
    on conflict(report,member) do update set present=excluded.present,voted_at=now()
    where v.present is distinct from excluded.present;
  if not found then return; end if;
  if still_present then
    update public.route_conditions set confirmed_at=now(),expires_at=now()+interval '30 minutes' where id=target;
  else
    select count(*) into negatives from public.route_condition_votes where report=target and not present and voted_at>=r.confirmed_at;
    update public.route_conditions set expires_at=case when negatives>=2 then now() else least(expires_at,now()+interval '5 minutes') end where id=target;
  end if;
end $$;

create function public.active_route_conditions(slug text)
returns table(id uuid, kind text, meters integer, longitude double precision, latitude double precision,
  confirmed_at timestamptz,expires_at timestamptz, own boolean, vote boolean)
language sql stable security definer set search_path='' as $$
  select r.id,r.kind,r.meters,r.longitude,r.latitude,r.confirmed_at,r.expires_at,
    coalesce(r.reporter=public.current_member_id(),false),v.present
  from public.route_conditions r left join public.route_condition_votes v
    on v.report=r.id and v.member=public.current_member_id()
  where public.current_member_id() is not null and r.route=slug and r.expires_at>now()
  order by r.meters
$$;
revoke all on function public.report_route_condition(text,text,integer,double precision,double precision),
 public.verify_route_condition(uuid,boolean,double precision,double precision), public.active_route_conditions(text) from public,anon;
grant execute on function public.report_route_condition(text,text,integer,double precision,double precision),
 public.verify_route_condition(uuid,boolean,double precision,double precision), public.active_route_conditions(text) to authenticated;
commit;
