import { haversineM } from './geo';
import type { GpsSample, ReplayCursor } from './types';

export type ReplayTimeline = {
  samples: GpsSample[];
  /** Cumulative accepted distance at each sample index. */
  cumulativeDistanceM: number[];
  /** Active elapsed ms from first sample (wall timestamps between samples). */
  cumulativeElapsedMs: number[];
  totalDistanceM: number;
  totalElapsedMs: number;
};

/**
 * Build a replay timeline from real samples only.
 * No road-snapping — positions stay on recorded fixes; scrub interpolates
 * linearly between adjacent samples (never invents road geometry).
 */
export function buildReplayTimeline(samples: readonly GpsSample[]): ReplayTimeline {
  const ordered = [...samples].sort((a, b) => a.timestampMs - b.timestampMs);
  const cumulativeDistanceM: number[] = [];
  const cumulativeElapsedMs: number[] = [];
  let dist = 0;
  const t0 = ordered[0]?.timestampMs ?? 0;
  for (let i = 0; i < ordered.length; i += 1) {
    const curr = ordered[i]!;
    if (i > 0) {
      const prev = ordered[i - 1]!;
      if (
        !curr.flags.discontinuity &&
        !curr.flags.poorAccuracy &&
        !prev.flags.poorAccuracy &&
        !prev.flags.discontinuity
      ) {
        dist += haversineM(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      }
    }
    cumulativeDistanceM.push(dist);
    cumulativeElapsedMs.push(Math.max(0, curr.timestampMs - t0));
  }
  return {
    samples: ordered,
    cumulativeDistanceM,
    cumulativeElapsedMs,
    totalDistanceM: dist,
    totalElapsedMs: cumulativeElapsedMs[cumulativeElapsedMs.length - 1] ?? 0,
  };
}

/**
 * Map progress 0..1 to a cursor. Interpolation only between real neighbors.
 */
export function scrubReplay(timeline: ReplayTimeline, progress: number): ReplayCursor | null {
  const { samples, cumulativeDistanceM, cumulativeElapsedMs, totalElapsedMs, totalDistanceM } =
    timeline;
  if (samples.length === 0) return null;
  const p = Math.min(1, Math.max(0, progress));
  if (samples.length === 1 || totalElapsedMs <= 0) {
    const s = samples[0]!;
    return {
      progress: p,
      latitude: s.latitude,
      longitude: s.longitude,
      distanceM: cumulativeDistanceM[0] ?? 0,
      elapsedMs: 0,
      sampleIndex: 0,
    };
  }

  const targetElapsed = p * totalElapsedMs;
  let idx = 0;
  for (let i = 0; i < cumulativeElapsedMs.length; i += 1) {
    if (cumulativeElapsedMs[i]! <= targetElapsed) idx = i;
    else break;
  }
  const curr = samples[idx]!;
  const next = samples[idx + 1];
  if (!next) {
    return {
      progress: p,
      latitude: curr.latitude,
      longitude: curr.longitude,
      distanceM: totalDistanceM,
      elapsedMs: totalElapsedMs,
      sampleIndex: idx,
    };
  }
  const t0 = cumulativeElapsedMs[idx]!;
  const t1 = cumulativeElapsedMs[idx + 1]!;
  const span = Math.max(1, t1 - t0);
  const local = Math.min(1, Math.max(0, (targetElapsed - t0) / span));
  return {
    progress: p,
    latitude: curr.latitude + (next.latitude - curr.latitude) * local,
    longitude: curr.longitude + (next.longitude - curr.longitude) * local,
    distanceM:
      (cumulativeDistanceM[idx] ?? 0) +
      ((cumulativeDistanceM[idx + 1] ?? cumulativeDistanceM[idx] ?? 0) -
        (cumulativeDistanceM[idx] ?? 0)) *
        local,
    elapsedMs: targetElapsed,
    sampleIndex: idx,
  };
}

export function formatDistanceM(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters >= 10_000 ? 1 : 2)} km`;
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
