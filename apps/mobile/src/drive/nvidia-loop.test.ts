import { expect, it } from 'vitest';
import route from '../data/nvidia-campus-route.json';
import { advanceRoute, routeDistances, type Progress, type RoutePoint } from './route-navigation';

it('preserves loop progress through a missed turn and finishes only after returning via Bowers', () => {
  const points = route.geometry.coordinates as RoutePoint[];
  const distances = routeDistances(points);
  let now = 1000;
  let state: Progress = { meters: 0, matchedAt: now, phase: 'following' };
  function update([longitude, latitude]: RoutePoint) {
    now += 10_000;
    state = advanceRoute(points, distances, state, { latitude, longitude, accuracyM: 6, timestamp: now }, now);
  }
  for (let index = 0; index < points.length; index++) {
    update(points[index]);
    if (index === 45) {
      const before = state.meters;
      update([points[index][0] + 0.003, points[index][1]]);
      expect(state.phase).toBe('off-route');
      expect(state.meters).toBe(before);
      update(points[index + 1]);
      expect(state.phase).toBe('following');
    }
    if (index < 134) expect(state.phase).not.toBe('finished');
  }
  expect(state.phase).toBe('finished');
  expect(state.meters).toBe(distances.at(-1));
});
