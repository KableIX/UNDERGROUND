import { describe, expect, it } from 'vitest';
import { exchangeStatusText, groupByTier, parseSection, sightingOutcome, supercargoCopy, tierLabel, tierRank, toggleFolio } from './copy';

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

describe('SupercarGO navigation helpers', () => {
  it('opens on the map unless a known section is asked for', () => {
    expect(parseSection(undefined)).toBe('map');
    expect(parseSection('exchange')).toBe('exchange');
    expect(parseSection('nonsense')).toBe('map');
  });
  it('selects at most three folios a side', () => {
    let s: string[] = [];
    for (const id of ['a', 'b', 'c', 'd']) s = toggleFolio(s, id);
    expect(s).toEqual(['a', 'b', 'c']);
    expect(toggleFolio(s, 'b')).toEqual(['a', 'c']);
  });
  it('says plainly where an offer stands', () => {
    expect(exchangeStatusText('open', true)).toBe('Waiting for you');
    expect(exchangeStatusText('void', false)).toBe('No longer valid');
  });
  it('tells a member at a curated meet it shows in an hour', () => {
    expect(sightingOutcome({ visibility: 'public', reason: null, publishAt: null, folio: false, atMeet: true })).toContain('in an hour');
  });
});
