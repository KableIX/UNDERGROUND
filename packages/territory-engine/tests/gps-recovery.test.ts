import { describe, expect, it } from 'vitest';
import {
  GPS_RECOVERY_STATUS,
  findGpsGaps,
  mergeGpsBuffers,
} from '../src/gps-recovery';
import { SIM_GPS_TRACK } from '../../../tests/fixtures/sim-evidence';

describe('background GPS recovery', () => {
  it('documents planned vs implemented honestly', () => {
    expect(GPS_RECOVERY_STATUS.feature).toBe('background_gps_recovery');
    expect(GPS_RECOVERY_STATUS.planned.length).toBeGreaterThan(0);
    expect(GPS_RECOVERY_STATUS.implemented).toContain(
      'Pure ordered GPS buffer merge with timestamp dedupe',
    );
    // Device background resume is planned, not claimed implemented.
    expect(
      GPS_RECOVERY_STATUS.planned.some((p) => p.toLowerCase().includes('background')),
    ).toBe(true);
  });

  it('merges recovered buffers and detects gaps (implemented harness)', () => {
    const recovered = [
      { t: 4_000, lng: -121.941, lat: 36.541 },
      { t: 20_000, lng: -121.92, lat: 36.52 },
    ];
    const merged = mergeGpsBuffers(SIM_GPS_TRACK, recovered);
    expect(merged.map((p) => p.t)).toEqual([1_000, 4_000, 7_000, 20_000]);
    expect(merged[1]?.lng).toBe(-121.941);

    const gaps = findGpsGaps(merged, 5_000);
    expect(gaps).toEqual([{ from: 7_000, to: 20_000, gapMs: 13_000 }]);
  });
});
