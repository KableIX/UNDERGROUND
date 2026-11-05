import type { InviteRedeemResult, SessionMember } from './types';
import { createDevBypassMember } from './dev-bypass';

/**
 * Local invitation redemption stub.
 * Does not invent live invite codes — only accepts the documented fixture code
 * `UNDERGROUND-FOUNDER-PREVIEW` in non-production for UX wiring.
 */
export function redeemInvitationCode(input: {
  code: string;
  appEnv: string | undefined;
}): InviteRedeemResult {
  if (input.appEnv === 'production') {
    return { ok: false, error: 'production_blocked' };
  }
  const normalized = input.code.trim().toUpperCase();
  if (normalized !== 'UNDERGROUND-FOUNDER-PREVIEW') {
    return { ok: false, error: 'invalid_code' };
  }
  const member: SessionMember = createDevBypassMember();
  return { ok: true, member };
}
