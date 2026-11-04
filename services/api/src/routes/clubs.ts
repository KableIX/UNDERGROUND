import {
  applyClubInvitationAction,
  ClubInvitationSchema,
  type ClubInviteAction,
} from '@underground/domain';
import { z } from 'zod';

export const ClubInviteActionRequestSchema = z.object({
  invitation: ClubInvitationSchema,
  actorId: z.string().uuid(),
  action: z.enum(['accept', 'reject', 'revoke']),
  occurredAt: z.string().datetime(),
});

export function handleClubInviteAction(raw: unknown) {
  const request = ClubInviteActionRequestSchema.parse(raw);
  return applyClubInvitationAction(
    request.invitation,
    request.actorId,
    request.action as ClubInviteAction,
    request.occurredAt,
  );
}
