import { describe, expect, it } from 'vitest';
import { mutationGate } from '../src/routes/mutation-gate';

describe('HTTP mutation fail-closed gate', () => {
  it('blocks unauthenticated mutation endpoints even in development', () => {
    for (const pathname of ['/v1/founder/provision', '/v1/garage/media/upload-intent', '/v1/runs/transition', '/v1/runs/evidence/review', '/v1/clubs/invitations/action', '/v1/territories/challenge']) {
      expect(mutationGate({ method: 'POST', pathname, appEnv: 'development' })).toEqual({
        allowed: false, status: 503, error: 'authenticated_mutations_not_configured',
      });
    }
  });
  it('permits simulation capture only in development', () => {
    expect(mutationGate({ method: 'POST', pathname: '/v1/sim/capture', appEnv: 'development' }).allowed).toBe(true);
    expect(mutationGate({ method: 'POST', pathname: '/v1/sim/capture', appEnv: 'production' }).allowed).toBe(false);
  });
  it('allows non-mutating requests', () => {
    expect(mutationGate({ method: 'GET', pathname: '/health', appEnv: 'production' }).allowed).toBe(true);
  });
});
