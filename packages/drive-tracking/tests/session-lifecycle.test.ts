import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyGpsFix,
  attachServerVerifiedCapture,
  createSessionEngine,
  endRecording,
  markPermissionDenied,
  markTerritoryAttempt,
  pauseRecording,
  resetIdSeqForTests,
  resumeRecording,
  startRecording,
  toTripSummary,
} from '../src/index';

describe('drive session lifecycle', () => {
  beforeEach(() => resetIdSeqForTests());

  it('starts, pauses, resumes, and ends with distance/duration', () => {
    let now = 1_000_000;
    let state = createSessionEngine({
      idFactory: p => `${p}_x`,
      nowMs: () => now,
      vehicleId: 'veh-1',
    });
    state = startRecording(state, { nowMs: () => now });
    expect(state.session.status).toBe('recording');
    expect(state.session.startedAtMs).toBe(now);

    const fix = (t: number, lat: number, lng: number) =>
      applyGpsFix(
        state,
        {
          timestampMs: t,
          latitude: lat,
          longitude: lng,
          altitudeM: 10,
          accuracyM: 8,
          speedMps: 12,
          headingDeg: 90,
        },
        { nowMs: () => now, idFactory: p => `${p}_${t}` },
      );

    let r = fix(now + 1000, 37.4, -122.1);
    state = r.state;
    expect(r.result.accepted).toBe(true);

    now += 5_000;
    r = fix(now, 37.401, -122.1);
    state = r.state;
    expect(state.session.distanceM).toBeGreaterThan(0);

    now += 2_000;
    state = pauseRecording(state, { nowMs: () => now });
    expect(state.session.status).toBe('paused');
    expect(state.session.activeDurationMs).toBeGreaterThan(0);
    const pausedDuration = state.session.activeDurationMs;

    now += 10_000; // paused wall time should not accumulate
    state = resumeRecording(state, { nowMs: () => now });
    expect(state.session.status).toBe('recording');
    expect(state.session.activeDurationMs).toBe(pausedDuration);

    now += 3_000;
    r = fix(now, 37.402, -122.1);
    state = r.state;

    now += 1_000;
    state = endRecording(state, { nowMs: () => now });
    expect(state.session.status).toBe('ended');
    expect(state.session.endedAtMs).toBe(now);
    expect(state.session.privacy).toBe('private');
    expect(state.privateSpeedMps).toBeNull();

    const summary = toTripSummary(state);
    expect(summary?.vehicleId).toBe('veh-1');
    expect(summary?.classification).toBe('ordinary');
    expect(summary?.sampleCount).toBe(3);
  });

  it('auto-pauses into permission_denied without fabricating samples', () => {
    let now = 2_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_p`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    now += 1000;
    state = markPermissionDenied(state, { nowMs: () => now });
    expect(state.session.status).toBe('permission_denied');
    expect(state.samples).toHaveLength(0);
    expect(state.events.some(e => e.kind === 'permission_lost')).toBe(true);
  });

  it('allows territory_attempt but only server id promotes verified_capture', () => {
    let now = 3_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_c`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    state = markTerritoryAttempt(state, 'route-curated-1', { nowMs: () => now });
    expect(state.session.classification).toBe('territory_attempt');
    expect(state.session.curatedRouteId).toBe('route-curated-1');

    state = attachServerVerifiedCapture(state, '', { nowMs: () => now });
    expect(state.session.classification).toBe('territory_attempt');

    state = attachServerVerifiedCapture(state, 'server-run-uuid', { nowMs: () => now });
    expect(state.session.classification).toBe('verified_capture');
    expect(state.session.serverVerifiedRunId).toBe('server-run-uuid');
  });
});
