import { parseApiEnv, type ApiEnv, hasSupabaseCredentials } from '@underground/domain';

export type RuntimeEnv = ApiEnv & {
  supabaseReady: boolean;
};

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  const parsed = parseApiEnv(raw);
  return {
    ...parsed,
    supabaseReady: hasSupabaseCredentials(parsed),
  };
}
