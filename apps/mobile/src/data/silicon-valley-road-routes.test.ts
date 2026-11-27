import { describe, expect, it } from 'vitest';
import routes from './silicon-valley-road-routes.json';
import { advanceRoute, initialProgress, routeDistances, type RoutePoint } from '../drive/route-navigation';

describe('Silicon Valley point-to-point candidates', () => {
  for (const [slug, route] of Object.entries(routes)) {
    it(slug + ' follows the stored road to its finish with ordered guidance', () => {
      const points = route.coordinates.map(([lng, lat]): RoutePoint => [lng, lat]);
      const distance = routeDistances(points);
      expect(points[0]).not.toEqual(points[points.length - 1]);
      expect(Math.abs(distance[distance.length - 1] / route.distanceMeters - 1)).toBeLessThan(0.03);
      const indices = route.maneuvers.map(turn => turn.index);
      expect(indices[0]).toBe(0);
      expect(indices[indices.length - 1]).toBe(points.length - 1);
      expect(indices.every((index, i) => i === 0 || index > indices[i - 1])).toBe(true);

      let progress = initialProgress;
      let timestamp = 1000;
      for (let i = 0; i < points.length; i++) {
        const [longitude, latitude] = points[i];
        const segment = i === 0 ? 0 : distance[i] - distance[i - 1];
        expect(segment).toBeLessThan(500);
        timestamp += Math.max(1000, Math.ceil(segment / 10) * 1000);
        progress = advanceRoute(points, distance, progress, { longitude, latitude, timestamp, accuracyM: 5 }, timestamp);
        expect(progress.phase).not.toBe('off-route');
      }
      expect(progress.phase).toBe('finished');
    });
  }
});
