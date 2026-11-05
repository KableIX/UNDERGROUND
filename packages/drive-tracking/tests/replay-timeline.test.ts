import { describe, expect, it } from 'vitest';
import {
  buildReplayTimeline,
  buildTerritoryEvidenceBundle,
  createSessionEngine,
  endRecording,
  applyGpsFix,
  formatDistanceM,
  formatDurationMs,
  isEligibleAsProductionCaptureEvidence,
  scrubReplay,
  startRecording,
  toSafeAnalyticsEvent,
  scrubLocationFromLogPayload,
  TRIP_PRIVACY_POLICY,
  markTerritoryAttempt,
} from '../src/index';
import type { GpsSample } from '../src/index';

function sample(
  i: number,
  lat: number,
  lng: number,
  opts: Partial<GpsSample['flags']> = {},
): GpsSample {
  return {
    id: `s${i}`,
    sessionId: 'trip',
    timestampMs: 1_000_000 + i * 1000,
    latitude: lat,
    longitude: lng,
    altitudeM: 5,
    accuracyM: 6,
    speedMps: 10,
    headingDeg: 0,
    flags: {
      poorAccuracy: false,
      discontinuity: false,
      duplicateOrStale: false,
      ...opts,
    },
  };
}

describe('route replay timeline', () => {
  it('scrubs between real samples only (no road snap)', () => {
    const samples = [
      sample(0, 37.0, -122.0),
      sample(1, 37.001, -122.0),
      sample(2, 37.002, -122.0),
    ];
    const timeline = buildReplayTimeline(samples);
    expect(timeline.totalElapsedMs).toBe(2000);
    expect(timeline.totalDistanceM).toBeGreaterThan(0);

    const mid = scrubReplay(timeline, 0.25);
    expect(mid).not.toBeNull();
    expect(mid!.latitude).toBeGreaterThan(37.0);
    expect(mid!.latitude).toBeLessThan(37.001);
    expect(mid!.longitude).toBeCloseTo(-122.0, 5);

    const end = scrubReplay(timeline, 1);
    expect(end!.latitude).toBeCloseTo(37.002, 5);
    expect(end!.distanceM).toBeCloseTo(timeline.totalDistanceM, 5);
  });

  it('formats distance and duration for UI', () => {
    expect(formatDistanceM(850)).toBe('850 m');
    expect(formatDurationMs(65_000)).toBe('1:05');
  });
});

describe('territory evidence separation + privacy', () => {
  it('builds evidence bundle that never claims ownership/CLOUT', () => {
    let now = 9_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_ev`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    state = markTerritoryAttempt(state, 'curated-route', { nowMs: () => now });
    state = applyGpsFix(
      state,
      {
        timestampMs: now,
        latitude: 37.4,
        longitude: -122.1,
        altitudeM: 1,
        accuracyM: 5,
        speedMps: 20,
        headingDeg: null,
      },
      { idFactory: p => `${p}_1` },
    ).state;
    state = applyGpsFix(
      state,
      {
        timestampMs: now + 2000,
        latitude: 37.401,
        longitude: -122.1,
        altitudeM: 1,
        accuracyM: 5,
        speedMps: 20,
        headingDeg: null,
      },
      { idFactory: p => `${p}_2` },
    ).state;
    now += 3000;
    state = endRecording(state, { nowMs: () => now });

    const bundle = buildTerritoryEvidenceBundle(state);
    expect(bundle).not.toBeNull();
    expect(bundle!.clientClaims.awardsOwnership).toBe(false);
    expect(bundle!.clientClaims.awardsClout).toBe(false);
    expect(bundle!.clientClaims.publishesRoute).toBe(false);
    // speed stripped
    expect(JSON.stringify(bundle)).not.toMatch(/speed/i);

    const eligibility = isEligibleAsProductionCaptureEvidence(bundle!);
    expect(eligibility.ok).toBe(true);
  });

  it('blocks ordinary trips as production capture evidence', () => {
    let now = 9_100_000;
    let state = createSessionEngine({ idFactory: p => `${p}_ord`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    state = applyGpsFix(
      state,
      {
        timestampMs: now,
        latitude: 1,
        longitude: 1,
        altitudeM: null,
        accuracyM: 5,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_1` },
    ).state;
    state = applyGpsFix(
      state,
      {
        timestampMs: now + 1000,
        latitude: 1.001,
        longitude: 1,
        altitudeM: null,
        accuracyM: 5,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_2` },
    ).state;
    state = endRecording(state, { nowMs: () => now + 2000 });
    const bundle = buildTerritoryEvidenceBundle(state)!;
    const eligibility = isEligibleAsProductionCaptureEvidence(bundle);
    expect(eligibility.ok).toBe(false);
  });

  it('scrubs location from analytics/logs', () => {
    expect(TRIP_PRIVACY_POLICY.autoPublishHomeOrPreciseRoute).toBe(false);
    expect(TRIP_PRIVACY_POLICY.publicRoadSpeedLeaderboards).toBe(false);
    const safe = toSafeAnalyticsEvent({
      name: 'trip_ended',
      tripId: 'trip_abc',
      classification: 'ordinary',
      distanceM: 2500,
      durationMs: 600_000,
      gpsQuality: 'good',
      sampleCount: 200,
    });
    expect(safe.tripIdHash.startsWith('t_')).toBe(true);
    expect(JSON.stringify(safe)).not.toMatch(/latitude|longitude|speed/i);

    const scrubbed = scrubLocationFromLogPayload({
      ok: true,
      latitude: 37.4,
      speedMps: 30,
      meta: { longitude: -122, tripId: 'x' },
    });
    expect(scrubbed.latitude).toBeUndefined();
    expect(scrubbed.speedMps).toBeUndefined();
    expect((scrubbed.meta as Record<string, unknown>).longitude).toBeUndefined();
    expect((scrubbed.meta as Record<string, unknown>).tripId).toBe('x');
  });
});
