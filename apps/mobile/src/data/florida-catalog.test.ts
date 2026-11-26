import { describe, expect, it } from 'vitest';
import california from './california-catalog.json';
import florida from './florida-catalog.json';
import geometry from './florida-road-routes.json';
import { floridaAccess } from './florida-access';
import { advanceRoute, initialProgress, routeDistances, type RoutePoint } from '../drive/route-navigation';

const time = 100_000;
function classify(latitude: number, longitude: number, accuracy = 25, timestamp = time) {
  return floridaAccess({ latitude, longitude, accuracy, timestamp }, time);
}

describe('Florida access', () => {
  it('recognizes the Panhandle, peninsula, Key West and Seven Mile Bridge', () => {
    for (const [lat, lng] of [[30.421, -87.217], [30.438, -84.281], [28.538, -81.379], [25.761, -80.192], [24.555, -81.783], [24.69, -81.18]]) {
      expect(classify(lat, lng)).toBe('inside');
    }
  });
  it('keeps previews available outside Florida and rejects unusable fixes', () => {
    for (const [lat, lng] of [[37.354, -121.955], [30.695, -88.04], [30.83, -83.28], [25.07, -77.34]]) {
      expect(classify(lat, lng)).toBe('away');
    }
    expect(floridaAccess(null, time)).toBe('unknown');
    expect(classify(25.761, -80.192, 501)).toBe('unknown');
    expect(classify(25.761, -80.192, 10, time - 90_001)).toBe('unknown');
    expect(classify(25.761, -80.192, 10, time + 1)).toBe('unknown');
  });
});

describe('Florida road book', () => {
  it('covers all 27 designated byways with distinct routes and stable deep links', () => {
    const all = [...florida, ...california];
    expect(new Set(all.map(r => r.id)).size).toBe(all.length);
    expect(new Set(all.map(r => r.slug)).size).toBe(all.length);
    expect(new Set(florida.map(r => r.bywayCode).filter(Boolean)).size).toBe(27);
    expect(Object.keys(geometry).length).toBe(florida.length);
  });
  for (const run of florida) {
    it(run.title + ' can be replayed from its first fix through the finish', () => {
      const road = geometry[run.id as keyof typeof geometry];
      const points = road.coordinates as RoutePoint[];
      const d = routeDistances(points);
      const end = points.length - 1;
      expect(Math.abs(d[end] / road.distanceMeters - 1)).toBeLessThan(0.03);
      expect(road.durationSeconds).toBeGreaterThan(0);
      expect(road.maneuvers[0].index).toBe(0);
      expect(road.maneuvers.at(-1)?.index).toBe(end);
      expect(road.maneuvers.every((m, i, a) => !i || m.index > a[i - 1].index)).toBe(true);
      expect(run.sequence.length).toBeGreaterThanOrEqual(3);
      for (const [lng, lat] of [points[0], points[end]]) expect(classify(lat, lng)).toBe('inside');
      let progress = initialProgress;
      let clock = time;
      for (let i = 0; i < points.length; i++) {
        const j = Math.max(0, i - 1);
        const span = d[i] - d[j];
        const samples = Math.max(1, Math.ceil(span / 60));
        for (let n = 1; n <= samples; n++) {
          const longitude = points[j][0] + (points[i][0] - points[j][0]) * n / samples;
          const latitude = points[j][1] + (points[i][1] - points[j][1]) * n / samples;
          clock += Math.max(1000, Math.round(100 * span / samples));
          progress = advanceRoute(points, d, progress, { longitude, latitude, accuracyM: 6, timestamp: clock }, clock);
          expect(progress.phase).not.toBe('off-route');
        }
      }
      expect(progress.phase).toBe('finished');
    });
  }
});
