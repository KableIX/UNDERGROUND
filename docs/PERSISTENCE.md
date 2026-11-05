# Persistence — mock vs durable

| Mode | When | Durable | How |
|------|------|---------|-----|
| **memory** | Default CI / no Docker / no Supabase | No | `@underground/persistence` `MemoryStore` + authz tests |
| **local-postgis** | `DATABASE_URL` set; `docker compose up -d postgis` | Yes | Apply `supabase/migrations/*.sql` in order; seeds under `supabase/seed/` |
| **supabase** | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Yes | Cloud PostGIS + RLS; gameplay writes via API service role |

## Current environment

This agent environment has **no Docker** and **no cloud Supabase credentials**. Runtime API therefore reports `mode=memory` via `GET /v1/persistence/status`.

## What is implemented vs mocked

| Surface | Status |
|---------|--------|
| SQL migrations + RLS (incl. invites, DMs, guestbook, credits, routes, GPS tracks) | **Implemented** (files) |
| Authz mirroring RLS in MemoryStore | **Implemented** + tested |
| API social/route handlers on MemoryStore | **Implemented** + tested |
| Applying migrations to a live DB | **Blocked** (no Docker/psql/Supabase) |
| Production garage media / evidence buckets | **Placeholder** until Supabase |

## Local PostGIS quickstart (operator)

```bash
docker compose up -d postgis
export DATABASE_URL=postgres://underground:underground_dev_only@localhost:54322/underground
# apply migrations in lexical order, then seeds (bind founder auth_user_id first)
```

Never commit real invite codes, service role keys, or member PII.
