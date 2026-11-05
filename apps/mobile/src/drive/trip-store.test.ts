import { describe, expect, it, beforeEach } from 'vitest';
import {
  MemoryTripStore,
  applyGpsFix,
  createSessionEngine,
  endRecording,
  startRecording,
} from '@underground/drive-tracking';
import { setTripStoreForTests, getTripStore } from './trip-store';

describe('mobile trip store wiring', () => {
  beforeEach(() => {
    setTripStoreForTests(new MemoryTripStore());
  });

  it('uses injectable store for delete + list', async () => {
    const store = getTripStore();
    let now = 11_000_000;
    let state = createSessionEngine({ idFactory: p => `${p}_m`, nowMs: () => now });
    state = startRecording(state, { nowMs: () => now });
    state = applyGpsFix(
      state,
      {
        timestampMs: now + 10,
        latitude: 36.5,
        longitude: -121.8,
        altitudeM: 12,
        accuracyM: 4,
        speedMps: 5,
        headingDeg: null,
      },
      { idFactory: p => `${p}_1` },
    ).state;
    now += 1000;
    state = endRecording(state, { nowMs: () => now });
    await store.saveSession(state);
    expect((await store.listTripSummaries()).length).toBe(1);
    await store.deleteTrip(state.session.id);
    expect(await store.getSession(state.session.id)).toBeNull();
  });
});
