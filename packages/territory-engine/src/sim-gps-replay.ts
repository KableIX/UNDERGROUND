import type { GpsPoint } from './gps-recovery';

/**
 * Deterministic sim GPS replay for SV development routes.
 * Never writes production ownership — callers must keep evidenceSource=simulation.
 */

export type SimGpsReplay = {
  territorySlug: string;
  points: GpsPoint[];
  durationMs: number;
  evidenceSource: 'simulation';
};

/** Linear interpolate along a LineString for fixture replay. */
export function buildSimGpsReplay(input: {
  territorySlug: string;
  coordinates: readonly [number, number][];
  startMs: number;
  stepMs?: number;
}): SimGpsReplay {
  const stepMs = input.stepMs ?? 1000;
  const points: GpsPoint[] = input.coordinates.map(([lng, lat], i) => ({
    t: input.startMs + i * stepMs,
    lng,
    lat,
  }));
  return {
    territorySlug: input.territorySlug,
    points,
    durationMs: Math.max(0, (points.length - 1) * stepMs),
    evidenceSource: 'simulation',
  };
}

export function checkpointsAlongReplay(
  replay: SimGpsReplay,
  everyN: number,
): Array<{ seq: number; point: GpsPoint }> {
  const out: Array<{ seq: number; point: GpsPoint }> = [];
  let seq = 0;
  for (let i = 0; i < replay.points.length; i += everyN) {
    out.push({ seq, point: replay.points[i]! });
    seq += 1;
  }
  return out;
}
