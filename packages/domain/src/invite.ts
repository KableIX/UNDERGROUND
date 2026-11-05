import { z } from 'zod';

export const MemberInvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

export const MemberInvitationSchema = z.object({
  id: z.string().uuid(),
  /** SHA-256 hex of invite code — never store plaintext codes in domain objects. */
  codeHash: z.string().min(16),
  invitedByMemberId: z.string().uuid().nullable(),
  inviteeEmailHash: z.string().nullable(),
  status: MemberInvitationStatusSchema,
  acceptedMemberId: z.string().uuid().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemberInvitation = z.infer<typeof MemberInvitationSchema>;
export type MemberInvitationStatus = z.infer<typeof MemberInvitationStatusSchema>;

export function acceptMemberInvitation(
  invite: MemberInvitation,
  memberId: string,
  nowIso: string,
):
  | { ok: true; invitation: MemberInvitation }
  | { ok: false; error: 'not_pending' | 'expired' } {
  if (invite.status !== 'pending') return { ok: false, error: 'not_pending' };
  if (invite.expiresAt && invite.expiresAt < nowIso) {
    return { ok: false, error: 'expired' };
  }
  return {
    ok: true,
    invitation: {
      ...invite,
      status: 'accepted',
      acceptedMemberId: memberId,
      updatedAt: nowIso,
    },
  };
}
