import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyGpsFix,
  createSessionEngine,
  ingestGpsFix,
  resetIdSeqForTests,
  startRecording,
  SIGNAL_LOSS_GAP_MS,
} from '../src/index';

describe('GPS discontinuities + signal loss', () => {
  beforeEach(() => resetIdSeqForTests());

  it('rejects invalid, duplicate, and stale fixes without fabricating', () => {
    const state = startRecording(
      createSessionEngine({ idFactory: p => `${p}_g` }),
      { nowMs: () => 1000 },
    );
    const base = {
      timestampMs: 2000,
      latitude: 37.5,
      longitude: -122.2,
      altitudeM: 1,
      accuracyM: 5,
      speedMps: 1,
      headingDeg: null,
    };
    const first = ingestGpsFix(state.session, [], base, p => `${p}_1`);
    expect(first.accepted).toBe(true);
    const samples = first.accepted ? [first.sample] : [];

    expect(ingestGpsFix(state.session, samples, base, p => `${p}_dup`).accepted).toBe(false);
    expect(
      ingestGpsFix(
        state.session,
        samples,
        { ...base, timestampMs: 1500 },
        p => `${p}_stale`,
      ).accepted,
    ).toBe(false);
    expect(
      ingestGpsFix(
        state.session,
        samples,
        { ...base, timestampMs: 3000, latitude: Number.NaN },
        p => `${p}_nan`,
      ).accepted,
    ).toBe(false);
  });

  it('flags jumps and excludes them from distance', () => {
    let now = 10_000;
    let state = startRecording(createSessionEngine({ idFactory: p => `${p}_j` }), {
      nowMs: () => now,
    });
    const a = applyGpsFix(
      state,
      {
        timestampMs: now,
        latitude: 37.0,
        longitude: -122.0,
        altitudeM: null,
        accuracyM: 5,
        speedMps: 10,
        headingDeg: null,
      },
      { idFactory: p => `${p}_a` },
    );
    state = a.state;
    // ~111km north in 1 second → impossible
    const b = applyGpsFix(
      state,
      {
        timestampMs: now + 1000,
        latitude: 38.0,
        longitude: -122.0,
        altitudeM: null,
        accuracyM: 5,
        speedMps: 10,
        headingDeg: null,
      },
      { idFactory: p => `${p}_b` },
    );
    state = b.state;
    expect(b.result.accepted).toBe(true);
    if (b.result.accepted) {
      expect(b.result.sample.flags.discontinuity).toBe(true);
      expect(b.result.distanceDeltaM).toBe(0);
    }
    expect(state.session.distanceM).toBe(0);
  });

  it('keeps poor-accuracy samples but skips distance', () => {
    let now = 20_000;
    let state = startRecording(createSessionEngine({ idFactory: p => `${p}_q` }), {
      nowMs: () => now,
    });
    state = applyGpsFix(
      state,
      {
        timestampMs: now,
        latitude: 37.4,
        longitude: -122.1,
        altitudeM: null,
        accuracyM: 5,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_1` },
    ).state;
    const poor = applyGpsFix(
      state,
      {
        timestampMs: now + 2000,
        latitude: 37.401,
        longitude: -122.1,
        altitudeM: null,
        accuracyM: 120,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_2` },
    );
    expect(poor.result.accepted).toBe(true);
    if (poor.result.accepted) {
      expect(poor.result.sample.flags.poorAccuracy).toBe(true);
      expect(poor.result.distanceDeltaM).toBe(0);
    }
  });

  it('emits signal_lost and signal_recovered across large gaps', () => {
    let now = 30_000;
    let state = startRecording(createSessionEngine({ idFactory: p => `${p}_sig` }), {
      nowMs: () => now,
    });
    state = applyGpsFix(
      state,
      {
        timestampMs: now,
        latitude: 37.4,
        longitude: -122.1,
        altitudeM: null,
        accuracyM: 8,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_1` },
    ).state;
    const gap = SIGNAL_LOSS_GAP_MS + 5_000;
    state = applyGpsFix(
      state,
      {
        timestampMs: now + gap,
        latitude: 37.4005,
        longitude: -122.1,
        altitudeM: null,
        accuracyM: 8,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_2` },
    ).state;
    expect(state.events.some(e => e.kind === 'signal_lost')).toBe(true);
    expect(state.events.some(e => e.kind === 'signal_recovered')).toBe(true);
  });

  it('rejects ingest while paused', () => {
    const started = startRecording(createSessionEngine({ idFactory: p => `${p}_z` }));
    const paused = {
      ...started,
      session: { ...started.session, status: 'paused' as const },
      segmentStartedAtMs: null,
    };
    const result = ingestGpsFix(
      paused.session,
      [],
      {
        timestampMs: 1,
        latitude: 1,
        longitude: 1,
        altitudeM: null,
        accuracyM: 1,
        speedMps: null,
        headingDeg: null,
      },
      p => `${p}_x`,
    );
    expect(result.accepted).toBe(false);
    if (!result.accepted) expect(result.reason).toBe('session_not_recording');
  });
});
