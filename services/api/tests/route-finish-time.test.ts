import { describe, expect, it } from 'vitest';
import catalog from '../../../apps/mobile/src/data/california-catalog.json';
import { validateFinish } from '../src/routes/route-finishes';
import { routeDistances, type RoutePoint } from '../../../apps/mobile/src/drive/route-navigation';
import caRoads from '../../../apps/mobile/src/data/california-road-routes.json';

describe('finish time for the nonce', () => {
  it('is the phone time of the fix that crossed the finish', () => {
    const row = catalog.find(r => r.id === 'M01')!;
    const points = (caRoads as Record<string, { coordinates: number[][] }>)[row.id]!.coordinates as RoutePoint[];
    const distances = routeDistances(points);
    const trace = points.map(([x, y], i) => [x, y, 4, 1000 + i + Math.ceil(distances[i]! * 100)] as [number, number, number, number]);
    const result = validateFinish({ kind: 'RUN', route: row.slug, attempt: 'one', trace }, 10_000_000_000);
    expect(result && 'finishedAtMs' in result && result.finishedAtMs).toBe(trace[0]![3] + (result as { duration: number }).duration);
  });
});
