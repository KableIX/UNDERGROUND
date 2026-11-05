import { describe, expect, it } from 'vitest';
import { buildMapboxSatelliteUrl, SV_DEV_CAMERA } from './mapbox-static';
import { boundsFromLineStrings, projectLonLat } from './geo-project';

describe('mapbox static + geo project', () => {
  it('returns null without token', () => {
    expect(
      buildMapboxSatelliteUrl({
        env: { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: '' },
        ...SV_DEV_CAMERA,
        width: 400,
        height: 300,
      }),
    ).toBeNull();
  });

  it('builds satellite URL when token present (value not logged)', () => {
    const url = buildMapboxSatelliteUrl({
      env: { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test-token' },
      ...SV_DEV_CAMERA,
      width: 400,
      height: 300,
    });
    expect(url).toContain('api.mapbox.com/styles/v1/mapbox/satellite-v9/static/');
    expect(url).toContain('access_token=pk.test-token');
  });

  it('projects lon/lat into view space', () => {
    const bounds = boundsFromLineStrings([
      [
        [-122, 37],
        [-121, 38],
      ],
    ]);
    const p = projectLonLat(-121.5, 37.5, bounds, 200, 100, 0);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(p.x).toBeLessThanOrEqual(200);
    expect(p.y).toBeLessThanOrEqual(100);
  });
});
