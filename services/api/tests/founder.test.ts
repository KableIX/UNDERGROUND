import { describe, expect, it } from 'vitest';
import { planFounderProvision } from '../src/routes/founder';

describe('planFounderProvision', () => {
  it('binds 000001 / STARK as founder member, not admin', () => {
    const plan = planFounderProvision({
      authUserId: '00000000-0000-4000-8000-000000000001',
      operatorToken: 'dry-run-operator',
    });
    expect(plan.mode).toBe('dry_run');
    expect(plan.member.memberNumber).toBe('000001');
    expect(plan.member.displayName).toBe('STARK');
    expect(plan.member.isFounder).toBe(true);
    expect(plan.member.role).toBe('member');
  });
});
