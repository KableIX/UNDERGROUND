import { describe, expect, it } from 'vitest';
import route from '../data/saratoga-club-route.json';
import turns from '../data/saratoga-turns.json';
import { advanceRoute, initialProgress, routeDistances, type Progress, type RoutePoint } from './route-navigation';

const points = route.geometry.coordinates as RoutePoint[];
const distances = routeDistances(points);
function step(state: Progress, [longitude, latitude]: RoutePoint, time: number, accuracyM = 5, now = time) {
  return advanceRoute(points, distances, state, { longitude, latitude, timestamp: time, accuracyM }, now);
}

describe('Saratoga navigation', () => {
  it('waits for a fresh, accurate fix at the start', () => {
    expect(step(initialProgress, points[100], 1000)).toEqual(initialProgress);
    expect(step(initialProgress, points[0], 1000, 100)).toEqual(initialProgress);
    expect(step(initialProgress, points[0], 1000, 5, 18000)).toEqual(initialProgress);
    expect(step(initialProgress, points[0], 1000)).toMatchObject({ meters: 0, phase: 'following' });
  });
  it('holds progress off-route and resumes when the driver returns', () => {
    const start = step(initialProgress, points[0], 1000);
    const lost = step(start, [points[0][0] + 0.02, points[0][1]], 2000);
    expect(lost).toMatchObject({ meters: 0, phase: 'off-route' });
    expect(step(lost, points[1], 11000)).toMatchObject({ phase: 'following' });
  });
  it('tracks the full saved loop with ordered turns and a finish at the end', () => {
    let state = initialProgress;
    for (const [index, point] of points.entries()) {
      const startIndex = Math.max(0, index - 1);
      const start = points[startIndex];
      const length = distances[index] - distances[startIndex];
      const samples = Math.max(1, Math.ceil(length / 30));
      for (let sample = 1; sample <= samples; sample++) {
        const t = sample / samples;
        const meters = distances[startIndex] + t * length;
        const previous = state;
        state = step(state, [start[0] + t * (point[0] - start[0]), start[1] + t * (point[1] - start[1])],
          1000 + Math.ceil(meters * 100) + index);
        expect(state.meters).toBeGreaterThanOrEqual(previous.meters);
        if (meters < distances[distances.length - 1] - 50) expect(state.phase, `point ${index}, progress ${state.meters} of ${meters}`).toBe('following');
      }
    }
    expect(state).toMatchObject({ phase: 'finished', meters: distances[distances.length - 1] });
    expect(turns.length).toBeGreaterThan(1);
    for (const [i, turn] of turns.entries()) {
      expect(distances[turn.index]).toBeDefined();
      if (i) expect(turn.index).toBeGreaterThanOrEqual(turns[i - 1].index);
    }
  });
});
