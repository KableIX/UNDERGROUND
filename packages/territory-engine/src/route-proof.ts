import type { GpsPoint } from './gps-recovery';

export type GpsSample = GpsPoint & { accuracyM: number };
export type GeoPoint = { lng: number; lat: number };
export type CaptureRouteGeometry = {
  polyline: GeoPoint[]; // reviewed, versioned, road-following geometry ONLY
  checkpoints: Array<GeoPoint & { radiusM: number }>; // ordered
  startZone: GeoPoint & { radiusM: number };
  finishZone: GeoPoint & { radiusM: number };
};
export type RouteProof = {
  samples: readonly GpsSample[];
  geometry: CaptureRouteGeometry;
  startOdometerMiles: number | null;
  finishOdometerMiles: number | null;
};
export type RouteProofVerdict = {
  status: 'passed' | 'manual_review' | 'rejected';
  reasons: string[];
  distanceM: number;
  checkpointCount: number;
};

const EARTH_RADIUS_M = 6371008.8;
const MI_TO_M = 1609.344;
const MAX_ACCURACY_M = 75;
const MAX_GAP_MS = 180000;
const MAX_PLAUSIBLE_MOVEMENT_MPS = 85; // GPS sanity flag, NEVER a speed score
const CORRIDOR_M = 300;
const MIN_VALID_SAMPLES = 3;

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function finiteCoordinate(p: GeoPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

function distanceToRoadM(point: GeoPoint, path: readonly GeoPoint[]): number {
  const latitude = point.lat * Math.PI / 180;
  const latitudeScale = EARTH_RADIUS_M * Math.PI / 180;
  const longitudeScale = latitudeScale * Math.cos(latitude);
  const toXY = (p: GeoPoint) => ({
    x: (p.lng - point.lng) * longitudeScale,
    y: (p.lat - point.lat) * latitudeScale,
  });
  let closest = Infinity;
  for (let i = 1; i < path.length; i += 1) {
    const a = toXY(path[i - 1]!);
    const b = toXY(path[i]!);
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const length2 = vx * vx + vy * vy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * vx + a.y * vy) / length2));
    closest = Math.min(closest, Math.hypot(a.x + t * vx, a.y + t * vy));
  }
  return closest;
}

/**
 * Pure server-side geographic plausibility evaluator.
 * Not cryptographic vehicle proof; cannot award ownership by itself.
 * Coordinates are evaluated against a reviewed road route and ordered geofences.
 */
export function evaluateGpsRouteProof(input: RouteProof): RouteProofVerdict {
  const reasons: string[] = [];
  const geometry = input.geometry;
  const path = geometry.polyline;
  if (
    path.length < 2 || path.some(p => !finiteCoordinate(p)) ||
    !finiteCoordinate(geometry.startZone) || !finiteCoordinate(geometry.finishZone) ||
    geometry.checkpoints.some(c => !finiteCoordinate(c) || c.radiusM <= 0)
  ) {
    return { status: 'rejected', reasons: ['invalid_route_geometry'], distanceM: 0, checkpointCount: 0 };
  }

  const samples = input.samples;
  if (samples.length < MIN_VALID_SAMPLES ||
    samples.some(p => !finiteCoordinate(p) || !Number.isFinite(p.t) || !Number.isFinite(p.accuracyM))) {
    return { status: 'rejected', reasons: ['invalid_gps_samples'], distanceM: 0, checkpointCount: 0 };
  }

  const valid = samples.filter(p => p.accuracyM >= 0 && p.accuracyM <= MAX_ACCURACY_M);
  if (valid.length < MIN_VALID_SAMPLES) {
    return { status: 'manual_review', reasons: ['insufficient_accurate_samples'], distanceM: 0, checkpointCount: 0 };
  }
  if (valid.length !== samples.length) reasons.push('gps_accuracy_drops');

  let distanceM = 0;
  for (let i = 1; i < valid.length; i += 1) {
    const prev = valid[i - 1]!;
    const curr = valid[i]!;
    const dtMs = curr.t - prev.t;
    if (dtMs <= 0) {
      return { status: 'rejected', reasons: ['nonmonotonic_time'], distanceM, checkpointCount: 0 };
    }
    const distance = haversineM(prev, curr);
    distanceM += distance;
    if (dtMs > MAX_GAP_MS) reasons.push('gps_gap_exceeded');
    if ((distance * 1000) / dtMs > MAX_PLAUSIBLE_MOVEMENT_MPS) reasons.push('implausible_gps_jump');
  }

  if (haversineM(valid[0]!, geometry.startZone) > geometry.startZone.radiusM) reasons.push('start_zone_missed');
  if (haversineM(valid[valid.length - 1]!, geometry.finishZone) > geometry.finishZone.radiusM) reasons.push('finish_zone_missed');

  let sampleIndex = 0;
  let reached = 0;
  for (const checkpoint of geometry.checkpoints) {
    const found = valid.findIndex((sample, i) =>
      i >= sampleIndex && haversineM(sample, checkpoint) <= checkpoint.radiusM,
    );
    if (found < 0) break;
    reached += 1;
    sampleIndex = found + 1;
  }
  if (reached !== geometry.checkpoints.length) reasons.push('ordered_checkpoints_missing');

  const offRoad = valid.filter(p => distanceToRoadM(p, path) > CORRIDOR_M).length;
  if (offRoad / valid.length > 0.15) reasons.push('outside_reviewed_route_corridor');

  if (input.startOdometerMiles != null && input.finishOdometerMiles != null) {
    const diff = input.finishOdometerMiles - input.startOdometerMiles;
    if (diff < 0) reasons.push('odometer_decreased');
    else if (Math.abs(diff * MI_TO_M - distanceM) > Math.max(3 * MI_TO_M, 0.35 * distanceM)) {
      reasons.push('odometer_gps_mismatch');
    }
  } else reasons.push('odometer_not_verified');

  const structurallyIncomplete = reasons.some(r =>
    ['start_zone_missed', 'finish_zone_missed', 'ordered_checkpoints_missing',
      'outside_reviewed_route_corridor', 'odometer_decreased'].includes(r),
  );
  return {
    status: structurallyIncomplete ? 'rejected' : reasons.length ? 'manual_review' : 'passed',
    reasons: [...new Set(reasons)],
    distanceM,
    checkpointCount: reached,
  };
}
