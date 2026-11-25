import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { it } from 'vitest';

it('enforces club radar privacy, validation, idempotency, rate limits and expiry in PostgreSQL', async () => {
  const root = new URL('../../../', import.meta.url);
  const read = (path: string) => readFile(fileURLToPath(new URL(path, root)), 'utf8');
  const [core, clubs, migration, checks] = await Promise.all([
    read('supabase/migrations/20261104000002_core_tables.sql'),
    read('supabase/migrations/20261104000005_clubs_social_directory.sql'),
    read('supabase/migrations/20261124000011_club_radar.sql'),
    read('tests/radar-postgres.sql'),
  ]);
  const db = new PGlite();
  try {
    // Use production table definitions; emulate only the Supabase auth session.
    // No PostGIS tables are needed by radar observations.
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;
      CREATE TYPE public.member_role AS ENUM ('member','admin');
      ${core.slice(core.indexOf('CREATE TABLE public.members'), core.indexOf('CREATE TABLE public.profiles'))}
      ${clubs.slice(0, clubs.indexOf('CREATE TABLE public.club_invitations'))}
      ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
      CREATE POLICY members_self ON public.members FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
      ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
      CREATE POLICY memberships_read ON public.club_memberships FOR SELECT TO authenticated USING(true);
      GRANT SELECT ON public.members,public.clubs,public.club_memberships TO authenticated;
      CREATE FUNCTION public.current_member_id() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT id FROM public.members WHERE auth_user_id=auth.uid()
      $$;
    `);
    await db.exec(migration);
    await db.exec(checks);
  } finally {
    await db.close();
  }
}, 30_000);
