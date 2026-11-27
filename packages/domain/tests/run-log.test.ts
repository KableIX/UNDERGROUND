import { describe, expect, it } from 'vitest';
import {
  FINISH_PHOTO_WINDOW_MS,
  FINISH_TIER_POINTS,
  checkFinishPhoto,
  computeRunAnalytics,
  finishCredit,
  routeTrend,
  runProgressPct,
  shareablePhotoClaim,
  summarizeRouteHistory,
  timeOfDayForHour,
  RunAbortReasonSchema,
  type FinishPhotoClaim,
  type RunSample,
} from '../src/run-log';

const T0 = Date.UTC(2026, 10, 27, 16, 0, 0); // 08:00 America/Los_Angeles

/** A straight north-bound drive: 1 fix/s at `mps`, with optional stop and gap. */
function drive(opts: { seconds: number; mps: number; stopFrom?: number; stopTo?: number; gapAt?: number; climbPerS?: number }): RunSample[] {
  const out: RunSample[] = [];
  let lat = 36.6;
  let t = T0;
  for (let i = 0; i <= opts.seconds; i++) {
    if (opts.gapAt != null && i === opts.gapAt) t += 30_000; // 30 s tunnel
    const stopped = opts.stopFrom != null && i >= opts.stopFrom && i < (opts.stopTo ?? 0);
    const v = stopped ? 0 : opts.mps;
    if (i > 0) lat += v / 111_195;
    out.push({ timestampMs: t, latitude: lat, longitude: -121.9, altitudeM: 10 + (opts.climbPerS ?? 0) * i, accuracyM: 5, speedMps: v });
    t += 1000;
  }
  return out;
}

describe('run analytics', () => {
  it('computes average speed, moving vs stopped time and time of day', () => {
    const samples = drive({ seconds: 600, mps: 20, stopFrom: 300, stopTo: 360 });
    const a = computeRunAnalytics({ samples, activeMs: 600_000, distanceM: 10_800, startedAtMs: T0, timeZone: 'America/Los_Angeles' });
    expect(a.avgSpeedMps).toBeCloseTo(18, 1);
    expect(a.movingMs).toBe(540_000);
    expect(a.stoppedMs).toBe(60_000);
    expect(a.avgMovingSpeedMps).toBeCloseTo(20, 1);
    expect(a.maxSpeedMps).toBe(20);
    expect(a.startLocalHour).toBe(8);
    expect(a.timeOfDay).toBe('morning');
    expect(a.gpsCoveragePct).toBe(100);
    expect(a.goodFixPct).toBe(100);
    expect(a.signalGapCount).toBe(0);
  });

  it('counts signal gaps as uncovered time', () => {
    const samples = drive({ seconds: 120, mps: 15, gapAt: 60 });
    const a = computeRunAnalytics({ samples, activeMs: 150_000, distanceM: 1800, startedAtMs: T0 });
    expect(a.signalGapCount).toBe(1);
    expect(a.gpsCoveragePct).toBeCloseTo(79.3, 1);
  });

  it('accumulates elevation with hysteresis and ignores noise', () => {
    const climbing = computeRunAnalytics({ samples: drive({ seconds: 100, mps: 10, climbPerS: 1 }), activeMs: 100_000, distanceM: 1000, startedAtMs: T0 });
    expect(climbing.elevationGainM).toBeGreaterThanOrEqual(96);
    expect(climbing.elevationLossM).toBe(0);
    const noisy = drive({ seconds: 60, mps: 10 }).map((s, i) => ({ ...s, altitudeM: 50 + (i % 2 ? 2 : -0) }));
    const flat = computeRunAnalytics({ samples: noisy, activeMs: 60_000, distanceM: 600, startedAtMs: T0 });
    expect(flat.elevationGainM).toBe(0);
    expect(flat.maxAltitudeM).toBe(52);
  });

  it('handles an empty run without inventing numbers', () => {
    const a = computeRunAnalytics({ samples: [], activeMs: 0, distanceM: 0, startedAtMs: null });
    expect(a).toMatchObject({ avgSpeedMps: null, maxSpeedMps: null, elevationGainM: null, timeOfDay: null, gpsCoveragePct: 0, sampleCount: 0 });
  });

  it('buckets the hour of day', () => {
    expect([4, 6, 9, 13, 18, 22].map(timeOfDayForHour)).toEqual(['night', 'dawn', 'morning', 'afternoon', 'evening', 'night']);
  });
});

describe('abort', () => {
  it('accepts only the six reasons and clamps progress', () => {
    expect(RunAbortReasonSchema.options).toEqual(['traffic', 'road_closed', 'weather', 'car_trouble', 'lost_gps', 'phone_issue']);
    expect(RunAbortReasonSchema.safeParse('bored').success).toBe(false);
    expect(runProgressPct(2500, 10_000)).toBe(25);
    expect(runProgressPct(12_000, 10_000)).toBe(100);
    expect(runProgressPct(-5, 10_000)).toBe(0);
    expect(runProgressPct(5, 0)).toBe(0);
  });
});

describe('finish photo credit', () => {
  const finish = { latitude: 36.6, longitude: -121.9, finishedAtMs: T0 };
  const at = (kind: 'car' | 'dash', over: Partial<FinishPhotoClaim> = {}): FinishPhotoClaim => ({
    kind, takenAtMs: T0 + 60_000, latitude: 36.6005, longitude: -121.9, accuracyM: 10, source: 'camera', ...over,
  });

  it('ranks the tiers dash < car < both', () => {
    expect(finishCredit([], finish, true)).toMatchObject({ tier: 'none', points: 0 });
    expect(finishCredit([at('dash')], finish, true)).toMatchObject({ tier: 'verified', points: FINISH_TIER_POINTS.verified });
    expect(finishCredit([at('car')], finish, true)).toMatchObject({ tier: 'car', points: FINISH_TIER_POINTS.car });
    expect(finishCredit([at('car'), at('dash')], finish, true)).toMatchObject({ tier: 'top', points: FINISH_TIER_POINTS.top });
    expect(FINISH_TIER_POINTS.verified).toBeLessThan(FINISH_TIER_POINTS.car);
    expect(FINISH_TIER_POINTS.car).toBeLessThan(FINISH_TIER_POINTS.top);
  });

  it('gives nothing without a GPS completion', () => {
    expect(finishCredit([at('car'), at('dash')], finish, false)).toMatchObject({ tier: 'none', points: 0 });
  });

  it('accepts photos inside the window, including after unlocking the phone', () => {
    expect(checkFinishPhoto(at('car', { takenAtMs: T0 + FINISH_PHOTO_WINDOW_MS - 1 }), finish)).toBe('accepted');
    expect(checkFinishPhoto(at('car', { takenAtMs: T0 + FINISH_PHOTO_WINDOW_MS + 1 }), finish)).toBe('late');
    expect(checkFinishPhoto(at('car', { takenAtMs: T0 - 10 * 60_000 }), finish)).toBe('early');
  });

  it('cross-checks location against the finish', () => {
    expect(checkFinishPhoto(at('car', { latitude: 36.62 }), finish)).toBe('off_location');
    expect(checkFinishPhoto(at('car', { latitude: null, longitude: null }), finish)).toBe('no_location');
    expect(checkFinishPhoto(at('car', { accuracyM: 500 }), finish)).toBe('no_location');
    // A far car photo drops the run to dash-only credit.
    expect(finishCredit([at('car', { latitude: 36.62 }), at('dash')], finish, true)).toMatchObject({ tier: 'verified', car: 'off_location', dash: 'accepted' });
  });

  it('never shares photo location', () => {
    expect(shareablePhotoClaim(at('car'))).toEqual({ kind: 'car', takenAtMs: T0 + 60_000 });
  });
});

describe('route history', () => {
  const day = 86_400_000;
  const attempts = [
    { route: 'pch', outcome: 'completed' as const, endedAtMs: T0, durationMs: 1_000_000 },
    { route: 'pch', outcome: 'aborted' as const, endedAtMs: T0 + day, abortReason: 'traffic' as const },
    { route: 'pch', outcome: 'completed' as const, endedAtMs: T0 + 2 * day, durationMs: 990_000 },
    { route: 'pch', outcome: 'aborted' as const, endedAtMs: T0 + 3 * day, abortReason: 'traffic' as const },
    { route: 'pch', outcome: 'aborted' as const, endedAtMs: T0 + 4 * day, abortReason: 'weather' as const },
    { route: 'pch', outcome: 'completed' as const, endedAtMs: T0 + 5 * day, durationMs: 1_010_000 },
    { route: 'pch', outcome: 'completed' as const, endedAtMs: T0 + 6 * day, durationMs: 900_000 },
    { route: 'other', outcome: 'completed' as const, endedAtMs: T0, durationMs: 1 },
  ];

  it('counts completions and aborts per route', () => {
    const h = summarizeRouteHistory(attempts, 'pch');
    expect(h).toMatchObject({ attempts: 7, completed: 4, aborted: 3, bestMs: 900_000, lastMs: 900_000 });
    expect(h.abortReasons).toEqual({ traffic: 2, weather: 1 });
    expect(h.recentMs).toEqual([1_000_000, 990_000, 1_010_000, 900_000]);
    expect(summarizeRouteHistory(attempts, 'none')).toMatchObject({ attempts: 0, completed: 0, aborted: 0, bestMs: null, trend: 'not_enough' });
  });

  it('reads a personal trend', () => {
    expect(routeTrend([100, 100, 100])).toBe('not_enough');
    expect(routeTrend([100, 100, 100, 90, 90, 90])).toBe('improving');
    expect(routeTrend([100, 100, 100, 101, 100, 100])).toBe('steady');
    expect(routeTrend([100, 100, 100, 110, 110, 110])).toBe('slower');
  });
});

describe('final values and retention', () => {
  it('uses the final points, radius and window', async () => {
    const m = await import('../src/run-log');
    expect([m.FINISH_POINTS_DASH, m.FINISH_POINTS_CAR, m.FINISH_POINTS_BOTH]).toEqual([10, 20, 30]);
    expect(m.FINISH_TIER_POINTS).toEqual({ none: 0, verified: 10, car: 20, top: 30 });
    expect(m.FINISH_PHOTO_RADIUS_M).toBe(250);
    expect(m.FINISH_PHOTO_WINDOW_MS).toBe(30 * 60 * 1000);
  });

  it('keeps raw data 90 days, then only the summary', async () => {
    const m = await import('../src/run-log');
    expect(m.RAW_TRACK_RETENTION_DAYS).toBe(90);
    expect(m.rawTrackCutoffMs(T0)).toBe(T0 - 90 * 86_400_000);
    const a = computeRunAnalytics({ samples: drive({ seconds: 60, mps: 20 }), activeMs: 60_000, distanceM: 1200, startedAtMs: T0 });
    const kept = m.retainedAnalytics(a);
    expect(kept).toMatchObject({ avgSpeedMps: a.avgSpeedMps, activeMs: 60_000, distanceM: 1200, maxSpeedMps: null, avgMovingSpeedMps: null });
  });
});
