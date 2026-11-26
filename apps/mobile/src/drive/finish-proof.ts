import { advanceRoute, initialProgress, routeDistances, type Fix, type RoutePoint } from './route-navigation';

// Only positions used for Run navigation enter the temporary verification trace.
export type RunFix = [longitude: number, latitude: number, accuracy: number, timestamp: number];
export function runFix(fix: Fix): RunFix {
  return [fix.longitude, fix.latitude, fix.accuracyM ?? -1, fix.timestamp];
}

export function verifiedDuration(points: RoutePoint[], trace: RunFix[], signalGap?: {entryIndex: number; exitIndex: number}): number | null {
  if (points.length < 2 || trace.length < 2) return null;
  const distances = routeDistances(points);
  let progress = initialProgress;
  for (const [i, [longitude, latitude, accuracyM, timestamp]] of trace.entries()) {
    const fix = { longitude, latitude, accuracyM, timestamp };
    progress = advanceRoute(points, distances, progress, fix, timestamp, signalGap);
    if (i === 0 && progress.phase !== 'following') return null;
    if (progress.phase === 'finished') {
      const duration = timestamp - trace[0]![3];
      return duration > 0 ? duration : null;
    }
  }
  return null;
}
