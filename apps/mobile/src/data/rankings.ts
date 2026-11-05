import type { RankingEntry } from '@underground/domain';

/** Fixture standings for Rankings tab — not live production ledgers. */
export const rankingFixtures: Array<Omit<RankingEntry, 'rank'>> = [
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
    territoriesHeld: 0,
  },
  {
    memberId: '33333333-3333-4333-8333-333333333303',
    displayName: 'BAY',
    memberNumber: '000003',
    cloutTotal: 10,
    territoriesHeld: 0,
  },
];
