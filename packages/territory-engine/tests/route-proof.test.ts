import { describe, expect, it } from 'vitest';
import { evaluateGpsRouteProof, type RouteProof } from '../src/route-proof';

const makeProof = (): RouteProof => ({
  geometry: {
    polyline: [{ lng: 0, lat: 0 }, { lng: 0.004, lat: 0 }],
    checkpoints: [{ lng: 0.002, lat: 0, radiusM: 75 }],
    startZone: { lng: 0, lat: 0, radiusM: 75 },
    finishZone: { lng: 0.004, lat: 0, radiusM: 75 },
  },
  samples: [0, 0.001, 0.002, 0.003, 0.004].map((lng, i) => ({
    lng, lat: 0, t: i * 30000, accuracyM: 8,
  })),
  startOdometerMiles: 1000,
  finishOdometerMiles: 1000.28,
});

describe('server route-proof plausibility validation', () => {
  it('accepts a coherent ordered trace (not standalone ownership proof)', () => {
    const result = evaluateGpsRouteProof(makeProof());
    expect(result).toMatchObject({ status: 'passed', reasons: [], checkpointCount: 1 });
    expect(result.distanceM).toBeGreaterThan(400);
  });
  it('rejects missed checkpoints', () => {
    const proof = makeProof();
    proof.geometry.checkpoints = [{ lng: 0.006, lat: 0, radiusM: 20 }];
    expect(evaluateGpsRouteProof(proof)).toMatchObject({
      status: 'rejected', reasons: ['ordered_checkpoints_missing'], checkpointCount: 0,
    });
  });
  it('rejects a finish outside the geofence', () => {
    const proof = makeProof();
    proof.geometry.finishZone = { lng: 0.01, lat: 0, radiusM: 20 };
    expect(evaluateGpsRouteProof(proof).reasons).toContain('finish_zone_missed');
  });
  it('rejects samples outside the approved route corridor', () => {
    const proof = makeProof();
    proof.samples = proof.samples.map((p, i) =>
      i === 1 || i === 2 ? { ...p, lat: 0.009 } : p,
    );
    const result = evaluateGpsRouteProof(proof);
    expect(result.status).toBe('rejected');
    expect(result.reasons).toContain('outside_reviewed_route_corridor');
  });
  it('flags impossible GPS jumps for manual review rather than awarding points', () => {
    const proof = makeProof();
    proof.samples = proof.samples.map((p, i) => i === 2 ? { ...p, t: 30100 } : p);
    const result = evaluateGpsRouteProof(proof);
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toContain('implausible_gps_jump');
  });
  it('flags inconsistent odometer mileage', () => {
    const proof = makeProof();
    proof.finishOdometerMiles = 1010;
    const result = evaluateGpsRouteProof(proof);
    expect(result.status).toBe('manual_review');
    expect(result.reasons).toContain('odometer_gps_mismatch');
  });
  it('rejects replayed nonmonotonic timestamps', () => {
    const proof = makeProof();
    proof.samples = proof.samples.map((p, i) => i === 2 ? { ...p, t: 0 } : p);
    expect(evaluateGpsRouteProof(proof).reasons).toContain('nonmonotonic_time');
  });
  it('flags insufficient accuracy', () => {
    const proof = makeProof();
    proof.samples = proof.samples.map(p => ({ ...p, accuracyM: 500 }));
    expect(evaluateGpsRouteProof(proof).status).toBe('manual_review');
  });
});
