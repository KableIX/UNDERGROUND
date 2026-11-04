import { describe, expect, it } from 'vitest';
import { applyClubInvitationAction } from '../src/club';
import { pendingClubInvite } from '../../../tests/fixtures/clubs-social';

describe('club invitation accept/reject', () => {
  it('accepts invite as invitee and creates membership', () => {
    const result = applyClubInvitationAction(
      pendingClubInvite,
      pendingClubInvite.inviteeId,
      'accept',
      '2026-11-04T03:00:00.000Z',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.status).toBe('accepted');
      expect(result.membership?.memberId).toBe(pendingClubInvite.inviteeId);
      expect(result.membership?.role).toBe('member');
    }
  });

  it('rejects invite as invitee without membership', () => {
    const result = applyClubInvitationAction(
      pendingClubInvite,
      pendingClubInvite.inviteeId,
      'reject',
      '2026-11-04T03:00:00.000Z',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.invitation.status).toBe('rejected');
      expect(result.membership).toBeNull();
    }
  });

  it('forbids accept by non-invitee', () => {
    const result = applyClubInvitationAction(
      pendingClubInvite,
      pendingClubInvite.inviterId,
      'accept',
      '2026-11-04T03:00:00.000Z',
    );
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });
});
