import { describe, expect, it } from 'vitest';
import { mutationGate } from '../src/routes/mutation-gate';

describe('HTTP mutation fail-closed gate', () => {
  const restricted = [
    '/v1/founder/provision',
    '/v1/garage/media/upload-intent',
    '/v1/runs/transition',
    '/v1/runs/evidence/review',
    '/v1/clubs/invitations/action',
    '/v1/territories/challenge',
    '/v1/social/friendships/action',
    '/v1/social/top8',
    '/v1/social/guestbook',
    '/v1/social/dm',
    '/v1/routes/plans',
  ];

  it('blocks all unverified mutations regardless of whether caller is local', () => {
    for (const pathname of restricted) {
      for (const appEnv of ['development', 'production']) {
        expect(mutationGate({ method: 'POST', pathname, appEnv, remoteAddress: '127.0.0.1' }))
          .toEqual({ allowed: false, status: 503, error: 'authenticated_mutations_not_configured' });
      }
    }
  });
  it('allows simulation capture only for local development and never production', () => {
    expect(mutationGate({ method: 'POST', pathname: '/v1/sim/capture', appEnv: 'development', remoteAddress: '127.0.0.1' }).allowed).toBe(true);
    expect(mutationGate({ method: 'POST', pathname: '/v1/sim/capture', appEnv: 'development', remoteAddress: '::1' }).allowed).toBe(true);
    expect(mutationGate({ method: 'POST', pathname: '/v1/sim/capture', appEnv: 'development', remoteAddress: '198.51.100.4' }).allowed).toBe(false);
    expect(mutationGate({ method: 'POST', pathname: '/v1/sim/capture', appEnv: 'production', remoteAddress: '127.0.0.1' }).allowed).toBe(false);
  });
  it('allows read-only requests', () => {
    expect(mutationGate({ method: 'GET', pathname: '/health', appEnv: 'production' }).allowed).toBe(true);
  });
});
