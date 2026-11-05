import { describe, expect, it } from 'vitest';
import { FOUNDER_DISPLAY_NAME, FOUNDER_MEMBER_NUMBER, MemberSchema } from '../src/member';

describe('founder identity', () => {
  it('uses 000001 / STARK constants', () => {
    expect(FOUNDER_MEMBER_NUMBER).toBe('000001');
    expect(FOUNDER_DISPLAY_NAME).toBe('STARK');
  });

  it('allows founder member without admin role', () => {
    const member = MemberSchema.parse({
      id: '00000000-0000-4000-8000-000000000010',
      authUserId: '00000000-0000-4000-8000-000000000011',
      memberNumber: FOUNDER_MEMBER_NUMBER,
      displayName: FOUNDER_DISPLAY_NAME,
      isFounder: true,
      role: 'member',
      createdAt: '2026-11-04T00:00:00.000Z',
    });
    expect(member.isFounder).toBe(true);
    expect(member.role).toBe('member');
  });
});
