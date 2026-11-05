import type { SessionMember } from './types';

/**
 * Dev-only auth bypass — hard-gated out of production builds.
 * Never enable when APP_ENV === 'production'.
 */
export function isDevAuthBypassAllowed(appEnv: string | undefined): boolean {
  if (appEnv === 'production') return false;
  // Metro __DEV__ is false in release; still require non-production APP_ENV.
  return appEnv === 'development' || appEnv === 'staging' || appEnv === undefined;
}

export function createDevBypassMember(): SessionMember {
  return {
    memberId: '33333333-3333-4333-8333-333333333301',
    memberNumber: '000001',
    displayName: 'STARK',
    isFounder: true,
    role: 'member',
  };
}
