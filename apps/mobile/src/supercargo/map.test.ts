import { describe, expect, it } from 'vitest';
import { cellRadiusM, cellStep, firstQueryBounds, fitRegion, groupCells, hoursUntilTradeable, regionToBounds, tierColor } from './map';

const seed = [
  { id: '1', cell_id: 'c0.02:1866:-4849', cell_lat: 37.33, cell_lng: -121.9509, tier: 'open' as const },
  { id: '2', cell_id: 'c0.02:1861:-4857', cell_lat: 37.23, cell_lng: -121.9899, tier: 'limited' as const },
  { id: '3', cell_id: 'c0.02:1872:-4850', cell_lat: 37.45, cell_lng: -122.1715, tier: 'numbered' as const },
  { id: '4', cell_id: 'c0.02:1870:-4845', cell_lat: 37.41, cell_lng: -121.9803, tier: 'allocated' as const },
  { id: '5', cell_id: 'c0.1:374:-971', cell_lat: 37.45, cell_lng: -122.247, tier: 'atelier' as const },
];

describe('SupercarGO map helpers', () => {
  it('reads the grid step from the cell id and draws a coarser area for rarer cars', () => {
    expect(cellStep('c0.02:1866:-4849')).toBe(0.02);
    expect(cellStep('c0.1:374:-971')).toBe(0.1);
    expect(cellStep('garbage')).toBe(0.02);
    expect(cellRadiusM('c0.02:1:1')).toBeGreaterThan(1000);
    expect(cellRadiusM('c0.1:1:1')).toBeGreaterThan(cellRadiusM('c0.02:1:1') * 4);
  });

  it('groups by cell and colors each cell by its rarest car', () => {
    const two = [...seed, { id: '6', cell_id: 'c0.02:1866:-4849', cell_lat: 37.33, cell_lng: -121.9509, tier: 'singular' as const }];
    const cells = groupCells(two);
    expect(cells).toHaveLength(5);
    const row = cells.find((c) => c.id === 'c0.02:1866:-4849')!;
    expect(row.tier).toBe('singular');
    expect(row.items.map((i) => i.id)).toEqual(['6', '1']);
    expect(tierColor('singular')).toBe('#C6B08B');
    expect(tierColor('atelier')).not.toBe(tierColor('singular'));
  });

  it('opens with every seeded neighborhood in frame, Buck\'s included', () => {
    const fix = { lat: 37.32, lng: -121.95 };
    const r = fitRegion(fix, seed.map((s) => ({ lat: s.cell_lat, lng: s.cell_lng })));
    const b = regionToBounds(r);
    for (const s of seed) {
      expect(s.cell_lng).toBeGreaterThan(b.west);
      expect(s.cell_lng).toBeLessThan(b.east);
      expect(s.cell_lat).toBeGreaterThan(b.south);
      expect(s.cell_lat).toBeLessThan(b.north);
    }
    expect(fitRegion(fix, []).latitudeDelta).toBe(0.1);
    expect(fitRegion(fix, [{ lat: 40, lng: -110 }]).longitudeDelta).toBe(1.2);
  });

  it('first query reaches Woodside from San Jose (the old 0.25 degree box did not)', () => {
    const q = firstQueryBounds({ lat: 37.32, lng: -121.95 });
    expect(q.west).toBeLessThan(-122.247);
    expect(-121.95 - 0.25).toBeGreaterThan(-122.247);
  });

  it('counts hours left on the 24-hour exchange hold', () => {
    const now = new Date('2026-11-27T22:00:00Z');
    expect(hoursUntilTradeable('2026-11-26T21:13:00Z', now)).toBe(0);
    expect(hoursUntilTradeable('2026-11-27T20:30:00Z', now)).toBe(23);
  });
});
