import { describe, expect, it } from 'vitest';
import {
  freshRadarFix,
  nearbyRadarReports,
  radarReportLabel,
  type ClubRadarReport,
} from '../src/radar';

const now = Date.parse('2026-11-24T12:00:00Z');
const fix = { latitude: 37.4, longitude: -122.1, accuracyM: 10, timestamp: now };
const report: ClubRadarReport = {
  id: '11111111-1111-4111-8111-111111111111',
  club_id: '22222222-2222-4222-8222-222222222222',
  reporter_id: '33333333-3333-4333-8333-333333333333',
  kind: 'radar',
  source: 'uniden_r8w',
  band: 'KA',
  strength: 5,
  direction: 'front',
  frequency_ghz: 34.7,
  latitude: 37.401,
  longitude: -122.1,
  accuracy_m: 10,
  created_at: new Date(now).toISOString(),
  expires_at: new Date(now + 300_000).toISOString(),
};
describe('radar location and expiry', () => {
  it('rejects stale, future, invalid, and inaccurate locations', () => {
    for (const invalid of [
      null,
      { ...fix, latitude: NaN },
      { ...fix, longitude: 181 },
      { ...fix, accuracyM: null },
      { ...fix, accuracyM: 101 },
      { ...fix, timestamp: now - 15_001 },
      { ...fix, timestamp: now + 2001 },
    ]) {
      expect(freshRadarFix(invalid, now)).toBeNull();
    }
    expect(freshRadarFix(fix, now)).toEqual(fix);
  });
  it('hides expired and distant reports; no location does not mean no reports', () => {
    expect(
      nearbyRadarReports(
        [
          report,
          { ...report, latitude: 38 },
          { ...report, expires_at: new Date(now).toISOString() },
        ],
        fix,
        now,
      ),
    ).toEqual([report]);
    expect(nearbyRadarReports([report], null, now)).toEqual([]);
  });
  it('keeps machine detections distinct from member sightings', () => {
    expect(radarReportLabel(report)).toBe('KA detected');
    expect(radarReportLabel({ kind: 'police_visual', band: null })).toBe(
      'Police sighting · member reported',
    );
  });
});
