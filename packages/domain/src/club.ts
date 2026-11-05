import { z } from 'zod';

export const ClubRoleSchema = z.enum(['owner', 'officer', 'member']);

export const ClubSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  foundingMarket: z.enum(['california', 'miami']),
  createdByMemberId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const ClubMembershipSchema = z.object({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: ClubRoleSchema,
  joinedAt: z.string().datetime(),
});

export const ClubInvitationStatusSchema = z.enum([
  'pending',
  'accepted',
  'rejected',
  'revoked',
]);

export const ClubInvitationSchema = z.object({
  id: z.string().uuid(),
  clubId: z.string().uuid(),
  inviterId: z.string().uuid(),
  inviteeId: z.string().uuid(),
  status: ClubInvitationStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Club = z.infer<typeof ClubSchema>;
export type ClubRole = z.infer<typeof ClubRoleSchema>;
export type ClubMembership = z.infer<typeof ClubMembershipSchema>;
export type ClubInvitation = z.infer<typeof ClubInvitationSchema>;
export type ClubInvitationStatus = z.infer<typeof ClubInvitationStatusSchema>;

export type ClubInviteAction = 'accept' | 'reject' | 'revoke';

export function applyClubInvitationAction(
  invitation: ClubInvitation,
  actorId: string,
  action: ClubInviteAction,
  nowIso: string,
):
  | { ok: true; invitation: ClubInvitation; membership: ClubMembership | null }
  | { ok: false; error: 'not_pending' | 'forbidden' | 'invalid_action' } {
  if (invitation.status !== 'pending') {
    return { ok: false, error: 'not_pending' };
  }

  if (action === 'revoke') {
    if (actorId !== invitation.inviterId) {
      return { ok: false, error: 'forbidden' };
    }
    return {
      ok: true,
      invitation: { ...invitation, status: 'revoked', updatedAt: nowIso },
      membership: null,
    };
  }

  if (actorId !== invitation.inviteeId) {
    return { ok: false, error: 'forbidden' };
  }

  if (action === 'reject') {
    return {
      ok: true,
      invitation: { ...invitation, status: 'rejected', updatedAt: nowIso },
      membership: null,
    };
  }

  if (action === 'accept') {
    return {
      ok: true,
      invitation: { ...invitation, status: 'accepted', updatedAt: nowIso },
      membership: {
        id: invitation.id, // deterministic stub id for tests; DB uses gen_random_uuid
        clubId: invitation.clubId,
        memberId: invitation.inviteeId,
        role: 'member',
        joinedAt: nowIso,
      },
    };
  }

  return { ok: false, error: 'invalid_action' };
}
