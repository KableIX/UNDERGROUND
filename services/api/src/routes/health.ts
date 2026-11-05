import type { RuntimeEnv } from '../env';
import type { HealthResponse } from '../contracts';

export function getHealth(env: RuntimeEnv): HealthResponse {
  return {
    ok: true,
    service: 'underground-api',
    appEnv: env.APP_ENV,
    supabaseReady: env.supabaseReady,
  };
}
