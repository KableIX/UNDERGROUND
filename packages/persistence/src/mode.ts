/**
 * Persistence mode documentation for operators and tests.
 *
 * - `memory`: in-process store (default in CI / no Docker). Authz-tested; NOT durable.
 * - `local-postgis`: docker-compose PostGIS + migrations (durable local).
 * - `supabase`: cloud Supabase when URL + service role present (not provisioned here).
 */

export type PersistenceMode = 'memory' | 'local-postgis' | 'supabase';

export type PersistenceStatus = {
  mode: PersistenceMode;
  durable: boolean;
  postgisAvailable: boolean;
  supabaseConfigured: boolean;
  notes: string;
};

export function resolvePersistenceMode(env: {
  DATABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): PersistenceStatus {
  const supabaseConfigured = Boolean(
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );
  if (supabaseConfigured) {
    return {
      mode: 'supabase',
      durable: true,
      postgisAvailable: true,
      supabaseConfigured: true,
      notes: 'Cloud Supabase + PostGIS; gameplay writes via service role API',
    };
  }
  if (env.DATABASE_URL) {
    return {
      mode: 'local-postgis',
      durable: true,
      postgisAvailable: true,
      supabaseConfigured: false,
      notes: 'Local PostGIS via DATABASE_URL; apply supabase/migrations',
    };
  }
  return {
    mode: 'memory',
    durable: false,
    postgisAvailable: false,
    supabaseConfigured: false,
    notes:
      'In-memory store for unit/integration authz tests. Spin docker compose postgis for durable local.',
  };
}
