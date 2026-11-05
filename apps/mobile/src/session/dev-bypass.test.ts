import { describe, expect, it } from 'vitest';
import { createDevBypassMember, isDevAuthBypassAllowed } from './dev-bypass';
import { redeemInvitationCode } from './invite-redeem';

describe('dev auth bypass + invite redeem', () => {
  it('allows bypass only outside production', () => {
    expect(isDevAuthBypassAllowed('development')).toBe(true);
    expect(isDevAuthBypassAllowed('staging')).toBe(true);
    expect(isDevAuthBypassAllowed(undefined)).toBe(true);
    expect(isDevAuthBypassAllowed('production')).toBe(false);
  });

  it('creates founder STARK as member role, not admin', () => {
    const member = createDevBypassMember();
    expect(member.displayName).toBe('STARK');
    expect(member.memberNumber).toBe('000001');
    expect(member.isFounder).toBe(true);
    expect(member.role).toBe('member');
  });

  it('redeems fixture invite only in non-production', () => {
    expect(redeemInvitationCode({ code: 'nope', appEnv: 'development' }).ok).toBe(false);
    expect(
      redeemInvitationCode({ code: 'UNDERGROUND-FOUNDER-PREVIEW', appEnv: 'production' }),
    ).toEqual({ ok: false, error: 'production_blocked' });
    const ok = redeemInvitationCode({
      code: 'underground-founder-preview',
      appEnv: 'development',
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.member.isFounder).toBe(true);
  });
});
