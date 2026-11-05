/** Fail closed until JWT verification, authorization and persistence are wired. */
export function mutationGate(input: {
  method?: string;
  pathname?: string;
  appEnv: string;
}): { allowed: boolean; status: number; error?: string } {
  if (input.method !== 'POST') return { allowed: true, status: 200 };
  if (input.pathname === '/v1/sim/capture' && input.appEnv === 'development') {
    return { allowed: true, status: 200 };
  }
  if (input.pathname?.startsWith('/v1/')) {
    return { allowed: false, status: 503, error: 'authenticated_mutations_not_configured' };
  }
  return { allowed: true, status: 200 };
}
