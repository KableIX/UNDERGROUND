export type RoutePoint = [number, number];
export type Fix = { latitude: number; longitude: number; accuracyM: number | null; timestamp: number };
export type Progress = { meters: number; matchedAt: number; phase: 'approach' | 'following' | 'off-route' | 'finished' };
export const initialProgress: Progress = { meters: 0, matchedAt: 0, phase: 'approach' };

function offset(a: RoutePoint, b: RoutePoint): RoutePoint {
  return [(b[0] - a[0]) * 111320 * Math.cos((a[1] + b[1]) * Math.PI / 360), (b[1] - a[1]) * 111320];
}
export function atRouteStart(point: RoutePoint, fix: Fix) {
  return Math.hypot(...offset(point, [fix.longitude, fix.latitude])) <= 65;
}
export function routeDistances(points: RoutePoint[]) {
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1]! + Math.hypot(...offset(points[i - 1]!, points[i]!)));
  return distances;
}
export function advanceRoute(points: RoutePoint[], distances: number[], state: Progress, fix: Fix, now: number, signalGap?: { entryIndex: number; exitIndex: number }): Progress {
  if (points.length < 2 || distances.length !== points.length || state.phase === 'finished' || fix.timestamp <= state.matchedAt || now - fix.timestamp > 15000 ||
      fix.accuracyM === null || fix.accuracyM > 50 || fix.accuracyM < 0) return state;
  const position: RoutePoint = [fix.longitude, fix.latitude];
  if (state.phase === 'approach') {
    return atRouteStart(points[0]!, fix) ? { meters: 0, matchedAt: fix.timestamp, phase: 'following' } : state;
  }
  // Allow reacquisition at a mapped tunnel exit after a fix at its entrance.
  let maxStep = 1200;
  if (signalGap) {
    const entry = distances[signalGap.entryIndex];
    const exit = distances[signalGap.exitIndex];
    if (entry !== undefined && exit !== undefined && state.meters >= entry - 100 && state.meters < exit) {
      maxStep = Math.max(maxStep, exit + 150 - state.meters);
    }
  }
  const limit = state.meters + Math.min(maxStep, Math.max(45, 46 * (fix.timestamp - state.matchedAt) / 1000));
  let closest = Infinity, along = state.meters;
  for (let i = 1; i < points.length && distances[i - 1]! <= limit; i++) {
    if (distances[i]! < state.meters - 55) continue;
    const [dx, dy] = offset(points[i - 1]!, points[i]!);
    const [px, py] = offset(points[i - 1]!, position);
    const pct = Math.min(1, Math.max(0, (px * dx + py * dy) / (dx * dx + dy * dy || 1)));
    const at = distances[i - 1]! + pct * (distances[i]! - distances[i - 1]!);
    const gap = Math.hypot(px - pct * dx, py - pct * dy);
    if (at > limit) continue;
    // A club stop can send the driver back along the exact same road.
    // At an equal lateral distance, prefer the first forward match over a past leg.
    const forwardTie = Math.abs(gap - closest) <= 0.5 && along < state.meters - 1 && at >= state.meters - 1;
    if (gap < closest - 0.5 || forwardTie) { closest = gap; along = at; }
  }
  if (closest > Math.max(32, fix.accuracyM * 1.5)) return { ...state, phase: 'off-route' };
  const total = distances[distances.length - 1]!;
  const finish = along > total * 0.98 && total - along < 25 && Math.hypot(...offset(points[points.length - 1]!, position)) < 30;
  return { meters: finish ? total : Math.max(state.meters, along), matchedAt: fix.timestamp, phase: finish ? 'finished' : 'following' };
}