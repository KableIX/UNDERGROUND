import { describe, expect, it } from 'vitest';
import catalog from '../../../apps/mobile/src/data/california-catalog.json';
import { runFinishPoint } from '../src/routes/route-finishes';
import { runPhotoPath, validateRunAttempt, validateRunPhotoIntent } from '../src/routes/run-attempts';

const member = '11111111-1111-4111-8111-111111111111';
const route = catalog.find(row => row.id === 'M01')!.slug;
const cruise = catalog.find(row => row.id === 'CR01')!.slug;
const finish = runFinishPoint(route)!;
const now = Date.UTC(2026, 10, 27, 18, 0, 0);
const analytics = {
  distanceM: 12_000, activeMs: 900_000, movingMs: 840_000, stoppedMs: 60_000,
  avgSpeedMps: 13.33, avgMovingSpeedMps: 14.29, maxSpeedMps: 24, elevationGainM: 120, elevationLossM: 80,
  minAltitudeM: 5, maxAltitudeM: 140, startedAtMs: now - 1_000_000, startLocalHour: 9, timeOfDay: 'morning',
  gpsCoveragePct: 98.5, goodFixPct: 91, sampleCount: 640, signalGapCount: 1,
};
const completed = {
  attempt: 'trip_abc_1', route, outcome: 'completed', abortReason: null, progressM: finish.lengthM, progressPct: 100,
  startedAtMs: now - 1_000_000, endedAtMs: now - 99_000, finishedAtMs: now - 100_000, vehicleId: 'car-1', startLabel: '36.60, -121.90',
  analytics, photos: [] as unknown[],
};
const photo = (kind: 'car' | 'dash', over: Record<string, unknown> = {}) => ({
  kind, takenAtMs: now - 60_000, latitude: finish.latitude, longitude: finish.longitude, accuracyM: 8, source: 'camera',
  storagePath: runPhotoPath(member, 'trip_abc_1', kind), ...over,
});

describe('run attempts', () => {
  it('records a completed run with its private analytics and no credit without photos', () => {
    const result = validateRunAttempt(completed, member, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.write.credit).toBeNull();
    expect(result.write.analytics.avgSpeedMps).toBe(13.33);
  });

  it('computes photo tiers server-side against the route finish', () => {
    const tier = (photos: unknown[]) => {
      const result = validateRunAttempt({ ...completed, photos }, member, now);
      return result.ok ? result.write.credit?.tier : result.error;
    };
    expect(tier([photo('dash')])).toBe('verified');
    expect(tier([photo('car')])).toBe('car');
    expect(tier([photo('car'), photo('dash')])).toBe('top');
    expect(tier([photo('car', { latitude: finish.latitude + 0.05 }), photo('dash')])).toBe('verified');
    expect(tier([photo('car', { takenAtMs: now - 100_000 + 31 * 60_000 })])).toBe('invalid_photo_time');
    expect(tier([photo('car'), photo('car')])).toBe('duplicate_photo_kind');
  });

  it('only accepts photos stored under the member and attempt', () => {
    const other = { ...completed, photos: [photo('car', { storagePath: runPhotoPath('22222222-2222-4222-8222-222222222222', 'trip_abc_1', 'car') })] };
    expect(validateRunAttempt(other, member, now)).toEqual({ ok: false, error: 'invalid_photo_path' });
    expect(validateRunPhotoIntent({ attempt: 'trip_abc_1', kind: 'dash', contentType: 'image/jpeg' }, member))
      .toEqual({ ok: true, path: `runs/${member}/trip_abc_1/dash.jpg` });
    expect(validateRunPhotoIntent({ attempt: '../x', kind: 'dash', contentType: 'image/jpeg' }, member).ok).toBe(false);
  });

  it('requires a reason for an abort and keeps photos off aborted runs', () => {
    const aborted = { ...completed, outcome: 'aborted', abortReason: 'road_closed', finishedAtMs: null, progressM: 4000, progressPct: 33.3 };
    expect(validateRunAttempt(aborted, member, now).ok).toBe(true);
    expect(validateRunAttempt({ ...aborted, abortReason: null }, member, now)).toEqual({ ok: false, error: 'invalid_abort' });
    expect(validateRunAttempt({ ...aborted, abortReason: 'bored' }, member, now)).toEqual({ ok: false, error: 'invalid_run_attempt' });
    expect(validateRunAttempt({ ...aborted, photos: [photo('car')] }, member, now)).toEqual({ ok: false, error: 'invalid_abort' });
  });

  it('rejects cruises, unknown routes, future times and implausible stats', () => {
    expect(validateRunAttempt({ ...completed, route: cruise }, member, now)).toEqual({ ok: false, error: 'unknown_run_route' });
    expect(validateRunAttempt({ ...completed, route: 'nope' }, member, now)).toEqual({ ok: false, error: 'unknown_run_route' });
    expect(validateRunAttempt({ ...completed, endedAtMs: now + 60_000 }, member, now)).toEqual({ ok: false, error: 'invalid_run_times' });
    expect(validateRunAttempt({ ...completed, analytics: { ...analytics, maxSpeedMps: 200 } }, member, now).ok).toBe(false);
    expect(validateRunAttempt({ ...completed, extra: true }, member, now).ok).toBe(false);
  });
});
