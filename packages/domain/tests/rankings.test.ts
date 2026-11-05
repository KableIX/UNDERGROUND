import { describe, expect, it } from 'vitest';
import { rankMembers } from '../src/rankings';

describe('rankMembers', () => {
  it('orders by clout then territories then member number', () => {
    const ranked = rankMembers([
      {
        memberId: '33333333-3333-4333-8333-333333333303',
        displayName: 'BAY',
        memberNumber: '000003',
        cloutTotal: 10,
        territoriesHeld: 0,
      },
      {
        memberId: '33333333-3333-4333-8333-333333333301',
        displayName: 'STARK',
        memberNumber: '000001',
        cloutTotal: 25,
        territoriesHeld: 0,
      },
      {
        memberId: '33333333-3333-4333-8333-333333333302',
        displayName: 'PACIFIC',
        memberNumber: '000002',
        cloutTotal: 25,
        territoriesHeld: 1,
      },
    ]);
    expect(ranked.map((r) => r.displayName)).toEqual(['PACIFIC', 'STARK', 'BAY']);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[2]?.rank).toBe(3);
  });
});
