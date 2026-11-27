import { describe, expect, it } from 'vitest';
import california from './california-catalog.json';
import florida from './florida-catalog.json';
import { regionCovers, stateCovers } from './road-book-covers';

describe('road book photography', () => {
  for (const [state, rows] of [
    ['CA', california],
    ['FL', florida],
  ] as const) {
    it('has a local cover for every ' + state + ' region', () => {
      const covers = regionCovers[state];
      expect(Object.keys(covers).sort()).toEqual([...new Set(rows.map((r) => r.region))].sort());
      expect(new Set(Object.values(covers)).size).toBe(Object.keys(covers).length);
      for (const [region, id] of Object.entries(covers))
        expect(rows.find((r) => r.id === id)?.region).toBe(region);
      expect(rows.some((r) => r.id === stateCovers[state].id)).toBe(true);
    });
  }
});
