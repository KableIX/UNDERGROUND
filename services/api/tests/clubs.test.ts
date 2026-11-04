import { describe, expect, it } from 'vitest';
import { handleClubInviteAction } from '../src/routes/clubs';
import { pendingClubInvite } from '../../../tests/fixtures/clubs-social';

describe('handleClubInviteAction', () => {
  it('accepts via API contract', () => {
    const result = handleClubInviteAction({
      invitation: pendingClubInvite,
      actorId: pendingClubInvite.inviteeId,
      action: 'accept',
      occurredAt: '2026-11-04T03:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.invitation.status).toBe('accepted');
  });
});
