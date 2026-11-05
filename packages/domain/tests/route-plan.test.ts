import { describe, expect, it } from 'vitest';
import {
  assertRoadFollowingContract,
  estimatePreviewDistanceM,
  GPX_IO_CONTRACT,
  TBT_ARCHITECTURE,
} from '../src/route-plan';

describe('route planning contracts', () => {
  it('rejects fabricated geometry on unreviewed_draft', () => {
    const result = assertRoadFollowingContract({
      title: 'Skyline loop',
      coordinates: [
        [-122.1, 37.3],
        [-122.2, 37.4],
      ],
      geometrySource: 'unreviewed_draft',
      waypoints: [
        {
          id: '11111111-1111-4111-8111-111111111101',
          kind: 'start',
          seq: 0,
          label: 'Start',
          lng: -122.1,
          lat: 37.3,
        },
        {
          id: '11111111-1111-4111-8111-111111111102',
          kind: 'finish',
          seq: 1,
          label: 'Finish',
          lng: -122.2,
          lat: 37.4,
        },
      ],
    });
    expect(result).toEqual({ ok: false, error: 'fabricated_geometry_forbidden' });
  });

  it('allows waypoints-only draft and provider-sourced geometry', () => {
    const draft = assertRoadFollowingContract({
      title: 'Technical canyon',
      coordinates: null,
      geometrySource: 'unreviewed_draft',
      waypoints: [
        {
          id: '11111111-1111-4111-8111-111111111101',
          kind: 'start',
          seq: 0,
          label: null,
          lng: -121.9,
          lat: 37.3,
        },
        {
          id: '11111111-1111-4111-8111-111111111102',
          kind: 'checkpoint',
          seq: 1,
          label: 'CP1',
          lng: -121.95,
          lat: 37.35,
        },
        {
          id: '11111111-1111-4111-8111-111111111103',
          kind: 'finish',
          seq: 2,
          label: null,
          lng: -122.0,
          lat: 37.4,
        },
      ],
    });
    expect(draft.ok).toBe(true);

    const provider = assertRoadFollowingContract({
      title: 'Provider snapped',
      coordinates: [
        [-121.9, 37.3],
        [-122.0, 37.4],
      ],
      geometrySource: 'mapbox_directions',
      waypoints: [
        {
          id: '11111111-1111-4111-8111-111111111101',
          kind: 'start',
          seq: 0,
          label: null,
          lng: -121.9,
          lat: 37.3,
        },
        {
          id: '11111111-1111-4111-8111-111111111103',
          kind: 'finish',
          seq: 1,
          label: null,
          lng: -122.0,
          lat: 37.4,
        },
      ],
    });
    expect(provider.ok).toBe(true);
  });

  it('exposes GPX/TBT/CarPlay architecture without entitlement assumption', () => {
    expect(GPX_IO_CONTRACT.export).toContain('operator_geometry');
    expect(TBT_ARCHITECTURE.carPlay.entitlementAssumed).toBe(false);
    expect(TBT_ARCHITECTURE.status).toBe('architecture_only');
    expect(estimatePreviewDistanceM([
      [-122.0, 37.0],
      [-122.1, 37.1],
    ])).toBeGreaterThan(0);
  });
});
