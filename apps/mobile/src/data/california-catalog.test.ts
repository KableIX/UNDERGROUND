import jacobsPass from './jacobs-pass-route.json';
import { describe, expect, it } from 'vitest';
import catalog from './california-catalog.json';
import california from './california-road-routes.json';
import local from './silicon-valley-road-routes.json';
import { winterNavigationPaused } from './route-advisories';
import { advanceRoute, initialProgress, routeDistances, type RoutePoint } from '../drive/route-navigation';

interface Road {
  signalGap?: { entryIndex: number; exitIndex: number };
  coordinates: number[][];
  maneuvers: {index: number; instruction: string}[];
  distanceMeters: number;
}
const roads: Record<string,Road> = {...california, EB01:jacobsPass, S01:local['saratoga-highway-9'], S07:local['page-mill-road'], S08:local['sierra-road'], S10:local['mount-hamilton-road'], P05:local['santa-clara-cupertino']};
describe('California catalog', () => {
  it('keeps distinct catalog IDs, slugs, territory assignments and the original ten priorities', () => {
    expect(new Set(catalog.map(r => r.id)).size).toBe(catalog.length);
    expect(new Set(catalog.map(r => r.slug)).size).toBe(catalog.length);
    expect(['RUN','CRUISE','TEST'].map(c => catalog.filter(r=>r.category===c).length)).toEqual([43,13,5]);
    expect(catalog.every(r => r.region && r.district && r.territory)).toBe(true);
    expect(catalog.filter(r => r.territory === 'Big Sur Coast').map(r => r.id)).toEqual(['M01','M02','M03']);
    expect(catalog.filter(r=>r.shortlist).map(r=>r.id).sort()).toEqual(['H03','H04','M01','M02','M03','N03','N04','S01','S03','S05']);
    expect(catalog.every(r => r.category === 'RUN' ? r.id === 'NAPA' || r.tier !== null : r.tier === null)).toBe(true);
  });
  it('joins the two northbound coastal Runs at Sea Walk Drive and ends at the De Leon approach', () => {
    expect(roads.N04.coordinates.at(-1)).toEqual(roads.N06.coordinates[0]);
    expect(roads.N06.coordinates.at(-1)).toEqual(roads.NC13.coordinates.at(-1));
  });
  it('connects both ends of Waddell Coast to their neighboring routes', () => {
    expect(roads.H06.coordinates[0]).toEqual(roads.H04.coordinates.at(-1));
    expect(roads.H06.coordinates.at(-1)).toEqual(roads.H05.coordinates[0]);
  });
  it('pauses Kings Canyon guidance on the announced California closure date', () => {
    const lastEvening = Date.parse('2026-11-12T23:59:59-08:00');
    expect(winterNavigationPaused('KS01', lastEvening)).toBe(false);
    expect(winterNavigationPaused('KS01', lastEvening + 1000)).toBe(true);
    expect(winterNavigationPaused('LA17', lastEvening + 1000)).toBe(false);
  });
  for (const r of catalog) {
    it(r.id + ' can follow its road from start to finish', () => {
      const road = roads[r.id];
      const points = road.coordinates as RoutePoint[];
      const distances = routeDistances(points);
      const end = points.length - 1;
      expect(Math.abs(distances[end]/road.distanceMeters-1)).toBeLessThan(0.03);
      const cues = road.maneuvers.map(m => m.index);
      expect(cues[0]).toBe(0);
      expect(cues[cues.length-1]).toBe(end);
      expect(cues.every((v,i) => i===0 || v>cues[i-1])).toBe(true);
      let progress = initialProgress;
      let clock = 1000;
      // A straight stretch can span a kilometer between map vertices. GPS continues reporting along it.
      for (let i = 0; i <= end; i++) {
        const previous = Math.max(0, i - 1);
        const span = distances[i] - distances[previous];
        const samples = Math.max(1, Math.ceil(span / 75));
        for (let n = 1; n <= samples; n++) {
          const fraction = n / samples;
          const longitude = points[previous][0] + fraction * (points[i][0] - points[previous][0]);
          const latitude = points[previous][1] + fraction * (points[i][1] - points[previous][1]);
          clock += Math.max(1000, Math.round(span / samples * 100));
          const fix = { longitude, latitude, accuracyM: 5, timestamp: clock };
          progress = advanceRoute(points, distances, progress, fix, clock, road.signalGap);
          expect(progress.phase).not.toBe('off-route');
        }
      }
      expect(progress.phase).toBe('finished');
    });
  }
});
