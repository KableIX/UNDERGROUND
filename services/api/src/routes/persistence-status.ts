import { resolvePersistenceMode } from '@underground/persistence';

export function getPersistenceStatus(env: NodeJS.ProcessEnv) {
  return resolvePersistenceMode({
    DATABASE_URL: env.DATABASE_URL,
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
