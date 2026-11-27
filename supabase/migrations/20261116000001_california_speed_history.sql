begin;
alter table public.route_conditions drop constraint route_conditions_kind_check;
alter table public.route_conditions add constraint route_conditions_kind_check
  check (kind in ('traffic_control','patrol','speed_check','crash','hazard','closure'));
create index route_speed_check_history on public.route_conditions(route,reported_at)
  where kind='speed_check';

-- Buckets follow distance along the driver's selected route. Use Pacific dates
-- so a club drive spanning UTC midnight is still one observation day.
create function public.route_speed_history(slug text)
returns table(start_m integer, end_m integer, occasions integer, last_month date)
language sql stable security definer set search_path='' as $$
  with observations as (
    select distinct (r.meters / 500)*500 as segment,
           (r.reported_at at time zone 'America/Los_Angeles')::date as day, r.reporter
    from public.route_conditions r
    where public.current_member_id() is not null and r.route=slug and r.kind='speed_check'
      and r.reporter is not null and r.reported_at between now()-interval '90 days' and now()
      and not exists (
        select 1 from public.route_condition_votes v
        where v.report=r.id and not v.present and v.voted_at>=r.confirmed_at
        group by v.report having count(*)>=2
      )
  ), candidates as (
    select segment,count(distinct day)::integer as days,max(day) as latest
    from observations group by segment
    having count(distinct day)>=3 and count(distinct reporter)>=3
  )
  select c.segment,c.segment+500,c.days,date_trunc('month',c.latest::timestamp)::date
  from candidates c
  where exists (
    select 1 from observations a join observations b on
      a.segment=b.segment and a.day<b.day and a.reporter<>b.reporter
    join observations d on b.segment=d.segment and b.day<d.day
      and d.reporter<>a.reporter and d.reporter<>b.reporter
    where a.segment=c.segment
  ) order by c.segment
$$;
revoke all on function public.route_speed_history(text) from public,anon;
grant execute on function public.route_speed_history(text) to authenticated;
commit;
