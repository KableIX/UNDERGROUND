/**
 * Temporary fail-closed API boundary.
 * No untrusted client can mutate server state before Supabase JWT verification,
 * member identity binding and per-resource authorization are implemented.
 * Simulation remains accessible only over the loopback interface in development.
 */
export function mutationGate(input: {
  method?: string;
  pathname?: string;
  appEnv: string;
  remoteAddress?: string;
}): { allowed: boolean; status: number; error?: string } {
  if (input.method !== 'POST') return { allowed: true, status: 200 };

  const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (
    input.pathname === '/v1/sim/capture' &&
    input.appEnv === 'development' &&
    loopback.includes(input.remoteAddress ?? '')
  ) {
    return { allowed: true, status: 200 };
  }

  if (input.pathname?.startsWith('/v1/')) {
    return { allowed: false, status: 503, error: 'authenticated_mutations_not_configured' };
  }
  return { allowed: true, status: 200 };
}
