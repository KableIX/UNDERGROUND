import { describe, expect, it } from 'vitest';
import { groupByTier, sightingOutcome, supercargoCopy, tierLabel, tierRank } from './copy';

describe('SupercarGO copy', () => {
  it('names tiers in our register and ranks them without points', () => {
    expect(tierLabel('singular')).toBe('Singular');
    expect(tierRank('open')).toBe(1);
    expect(tierRank('singular')).toBe(6);
  });
  it('never uses game furniture', () => {
    const all = JSON.stringify(supercargoCopy).toLowerCase();
    for (const word of ['xp', 'streak', 'level up', 'points', 'gotta', '!']) expect(all).not.toContain(word);
  });
  it('tells the member when others will see it', () => {
    const now = new Date('2026-11-27T12:00:00Z');
    expect(sightingOutcome({ visibility: 'public', reason: null, publishAt: '2026-11-28T00:00:00Z', folio: true }, now)).toBe(
      'Logged. Members see it in 12 hours, at neighborhood scale. Added to the Ledger.',
    );
    expect(sightingOutcome({ visibility: 'private', reason: 'home_zone', publishAt: null, folio: true })).toContain('privately');
  });
  it('orders the Ledger rarest first', () => {
    const g = groupByTier([{ tier: 'open' as const }, { tier: 'atelier' as const }, { tier: 'open' as const }]);
    expect(g.map((x) => x.tier)).toEqual(['atelier', 'open']);
    expect(g[1]!.items).toHaveLength(2);
  });
});
