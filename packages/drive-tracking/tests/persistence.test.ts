import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyGpsFix,
  createSessionEngine,
  endRecording,
  MemoryTripStore,
  recoverInterruptedSession,
  resetIdSeqForTests,
  startRecording,
  markInterrupted,
} from '../src/index';

describe('trip persistence + interruption recovery', () => {
  const store = new MemoryTripStore();

  beforeEach(() => {
    resetIdSeqForTests();
    store.clear();
  });

  it('persists session and samples offline and reloads', async () => {
    let now = 5_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_s`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    const applied = applyGpsFix(
      state,
      {
        timestampMs: now + 500,
        latitude: 36.6,
        longitude: -121.9,
        altitudeM: 20,
        accuracyM: 5,
        speedMps: 8,
        headingDeg: null,
      },
      { nowMs: () => now, idFactory: p => `${p}_1` },
    );
    state = applied.state;
    now += 2000;
    state = endRecording(state, { nowMs: () => now });
    await store.saveSession(state);

    const loaded = await store.getSession(state.session.id);
    expect(loaded?.samples).toHaveLength(1);
    expect(loaded?.session.distanceM).toBe(state.session.distanceM);

    const list = await store.listTripSummaries();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(state.session.id);
  });

  it('deletes trip and local GPS samples', async () => {
    let now = 6_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_d`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    state = endRecording(state, { nowMs: () => now + 1000 });
    await store.saveSession(state);
    await store.deleteTrip(state.session.id);
    expect(await store.getSession(state.session.id)).toBeNull();
    expect(await store.listTripSummaries()).toHaveLength(0);
  });

  it('recovers interrupted sessions without fabricating GPS', async () => {
    let now = 7_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_i`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    const applied = applyGpsFix(
      state,
      {
        timestampMs: now + 200,
        latitude: 37.0,
        longitude: -122.0,
        altitudeM: null,
        accuracyM: 10,
        speedMps: null,
        headingDeg: null,
      },
      { idFactory: p => `${p}_a`, nowMs: () => now },
    );
    state = applied.state;
    now += 5_000;
    state = markInterrupted(state, { nowMs: () => now, idFactory: p => `${p}_e` });
    await store.saveSession(state);

    const found = await store.findRecoverableSession();
    expect(found?.session.status).toBe('interrupted');
    expect(found?.samples).toHaveLength(1);

    now += 60_000;
    const recovered = recoverInterruptedSession(found!, { nowMs: () => now });
    expect(recovered.recoverable).toBe(true);
    expect(recovered.state.session.status).toBe('paused');
    expect(recovered.state.samples).toHaveLength(1);
    expect(recovered.state.samples[0]?.latitude).toBe(37.0);
  });

  it('abandons sessions older than interrupt window', () => {
    let now = 8_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_old`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    state = markInterrupted(state, { nowMs: () => now, idFactory: p => `${p}_e` });
    now += 7 * 60 * 60 * 1000;
    const recovered = recoverInterruptedSession(state, { nowMs: () => now });
    expect(recovered.recoverable).toBe(false);
    expect(recovered.reason).toBe('abandoned_stale');
    expect(recovered.state.session.status).toBe('ended');
  });
});
