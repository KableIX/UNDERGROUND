/**
 * Background GPS recovery — PLAN vs IMPLEMENTATION status.
 *
 * PLANNED (not implemented against device APIs):
 * - Resume interrupted RECORDING runs after process death
 * - Merge buffered location batches with server checkpoint watermarks
 * - Detect gaps > threshold and force EVIDENCE_REVIEW flags
 *
 * IMPLEMENTED (this module):
 * - Pure merge of ordered GPS points with dedupe by timestamp
 * - Gap detection helper for tests
 */

export type GpsPoint = {
  t: number;
  lng: number;
  lat: number;
};

export type GpsRecoveryStatus = {
  feature: 'background_gps_recovery';
  planned: readonly string[];
  implemented: readonly string[];
};

export const GPS_RECOVERY_STATUS: GpsRecoveryStatus = {
  feature: 'background_gps_recovery',
  planned: [
    'iOS background location resume after process death',
    'Server checkpoint watermark sync',
    'Gap > threshold forces EVIDENCE_REVIEW flag',
  ],
  implemented: [
    'Pure ordered GPS buffer merge with timestamp dedupe',
    'Gap detection helper for unit tests',
  ],
};

/** Merge two buffered GPS batches; later duplicate timestamps win. */
export function mergeGpsBuffers(
  primary: readonly GpsPoint[],
  recovered: readonly GpsPoint[],
): GpsPoint[] {
  const byTime = new Map<number, GpsPoint>();
  for (const p of primary) byTime.set(p.t, p);
  for (const p of recovered) byTime.set(p.t, p);
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

export function findGpsGaps(
  points: readonly GpsPoint[],
  maxGapMs: number,
): Array<{ from: number; to: number; gapMs: number }> {
  const gaps: Array<{ from: number; to: number; gapMs: number }> = [];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const gapMs = curr.t - prev.t;
    if (gapMs > maxGapMs) {
      gaps.push({ from: prev.t, to: curr.t, gapMs });
    }
  }
  return gaps;
}
