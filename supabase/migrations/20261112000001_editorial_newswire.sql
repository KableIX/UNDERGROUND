begin;
create table public.newswire_editorial (
  story_id text primary key,
  headline text not null,
  body text not null,
  action_label text not null,
  source_url text not null check (source_url like 'https://%'),
  verified_at timestamptz not null,
  expires_at timestamptz not null,
  withdrawn boolean not null default false,
  published_at timestamptz not null default now()
);
alter table public.newswire_editorial enable row level security;
revoke all on public.newswire_editorial from public, anon, authenticated, service_role;
grant select on public.newswire_editorial to authenticated;
grant select, insert, update on public.newswire_editorial to service_role;
create policy editorial_member_read on public.newswire_editorial for select to authenticated
  using (public.current_member_id() is not null and not withdrawn and expires_at > now());

-- An older retry cannot overwrite a correction or withdrawal.
create function public.put_newswire_editorial(p jsonb)
returns setof public.newswire_editorial language sql security invoker set search_path = '' as $$
  insert into public.newswire_editorial as old
    (story_id, headline, body, action_label, source_url, verified_at, expires_at, withdrawn)
  values (p->>'story_id', p->>'headline', p->>'body', p->>'action_label', p->>'source_url',
    (p->>'verified_at')::timestamptz, (p->>'expires_at')::timestamptz, (p->>'withdrawn')::boolean)
  on conflict (story_id) do update set
    headline = excluded.headline, body = excluded.body, action_label = excluded.action_label,
    source_url = excluded.source_url, verified_at = excluded.verified_at,
    expires_at = excluded.expires_at, withdrawn = excluded.withdrawn
  where excluded.verified_at > old.verified_at or (excluded.verified_at = old.verified_at and
    (excluded.headline, excluded.body, excluded.action_label, excluded.source_url, excluded.expires_at, excluded.withdrawn)
    = (old.headline, old.body, old.action_label, old.source_url, old.expires_at, old.withdrawn))
  returning old.*;
$$;
revoke all on function public.put_newswire_editorial(jsonb) from public, anon, authenticated;
grant execute on function public.put_newswire_editorial(jsonb) to service_role;
commit;
