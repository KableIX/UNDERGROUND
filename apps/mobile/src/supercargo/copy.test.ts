import { describe, expect, it } from 'vitest';
import {
  anchorProblems,
  anchorSlug,
  decisionText,
  exchangeStatusText,
  groupByTier,
  mapQueryBounds,
  parseSection,
  reportReasonText,
  sightingOutcome,
  supercargoCopy,
  tierLabel,
  tierRank,
  toggleFolio,
  weekStartOf,
} from './copy';

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


describe('SupercarGO map reloads as you pan', () => {
  const view = { west: -122, east: -121.8, south: 37.2, north: 37.4 };
  it('queries a padded box the first time', () => {
    const q = mapQueryBounds(null, view)!;
    expect(q.west).toBeLessThan(view.west);
    expect(q.north).toBeGreaterThan(view.north);
  });
  it('does not reload while the view stays inside the last query', () => {
    const q = mapQueryBounds(null, view)!;
    expect(mapQueryBounds(q, { west: -121.98, east: -121.82, south: 37.22, north: 37.38 })).toBeNull();
  });
  it('reloads after a pan and caps the span when zoomed out', () => {
    const q = mapQueryBounds(null, view)!;
    expect(mapQueryBounds(q, { west: -121.5, east: -121.3, south: 37.2, north: 37.4 })).not.toBeNull();
    const wide = mapQueryBounds(null, { west: -125, east: -115, south: 33, north: 40 })!;
    expect(wide.east - wide.west).toBeLessThanOrEqual(1.2001);
  });
});

describe('SupercarGO admin and moderation helpers', () => {
  it('makes a place id from its name', () => {
    expect(anchorSlug('Cars & Coffee — Los Gatos')).toBe('cars-coffee-los-gatos');
  });
  it('asks for the public-place confirmation', () => {
    expect(anchorProblems({ name: 'Overlook', lat: '37.3', lng: '-121.9', publicPlace: false })).toEqual([
      'Confirm it is a public place, not a residential street.',
    ]);
    expect(anchorProblems({ name: 'Overlook', lat: '37.3', lng: '-121.9', publicPlace: true })).toEqual([]);
    expect(anchorProblems({ name: '', lat: '99', lng: '', publicPlace: true })).toHaveLength(3);
  });
  it('finds the Monday of the week', () => {
    expect(weekStartOf(new Date('2026-11-27T12:00:00Z'))).toBe('2026-11-23');
    expect(weekStartOf(new Date('2026-11-27T12:00:00Z'), 1)).toBe('2026-11-30');
    expect(weekStartOf(new Date('2026-11-23T00:00:00Z'))).toBe('2026-11-23');
  });
  it('words every report reason and decision', () => {
    expect(Object.keys(reportReasonText)).toHaveLength(8);
    expect(decisionText('correct_model')).toBe('Model corrected');
  });
});
