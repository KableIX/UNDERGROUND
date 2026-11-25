import { describe, expect, it } from 'vitest';
import { RadarShareGate } from './share-gate';
import type { RadarAlert } from '@underground/domain';

const alert: RadarAlert = {
  band: 'KA',
  strength: 5,
  direction: 'front',
  frequencyGhz: 35.478,
  muted: false,
};
const now = 1_000_000;
const request = {
  enabled: true,
  clubId: 'club-a',
  source: 'uniden_r8' as const,
  recognized: true,
  healthy: true,
  alerts: [alert],
  fix: { latitude: 37, longitude: -122, accuracyM: 10, timestamp: now },
  now,
};

describe('private detector sharing gate', () => {
  it('requires opt in, club, healthy stream, and a recent accurate fix', () => {
    for (const change of [
      { enabled: false },
      { clubId: null },
      { source: null },
      { recognized: false },
      { healthy: false },
      { fix: null },
      { fix: { ...request.fix, timestamp: now - 16_000 } },
      { fix: { ...request.fix, accuracyM: 101 } },
      { alerts: [{ ...alert, muted: true }] },
      { alerts: [{ ...alert, muted: null }] },
    ]) {
      expect(new RadarShareGate().take({ ...request, ...change })).toBeNull();
    }
  });
  it('does not repeatedly publish strength/direction fluctuations from one signal', () => {
    const gate = new RadarShareGate();
    expect(gate.take(request)).toEqual(alert);
    expect(
      gate.take({
        ...request,
        now: now + 40_000,
        fix: { ...request.fix, timestamp: now + 40_000 },
        alerts: [{ ...alert, direction: 'rear', strength: 8 }],
      }),
    ).toBeNull();
    expect(
      gate.take({
        ...request,
        now: now + 301_000,
        fix: { ...request.fix, timestamp: now + 301_000 },
      }),
    ).toEqual(alert);
  });
  it('rate limits distinct signals too, while allowing a later observation', () => {
    const gate = new RadarShareGate();
    gate.take(request);
    const other = { ...alert, frequencyGhz: 34.7 };
    expect(gate.take({ ...request, alerts: [other], now: now + 1000 })).toBeNull();
    expect(
      gate.take({
        ...request,
        alerts: [other],
        now: now + 31_000,
        fix: { ...request.fix, timestamp: now + 31_000 },
      }),
    ).toEqual(other);
  });
});
