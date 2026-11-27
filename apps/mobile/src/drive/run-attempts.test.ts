import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { computeRunAnalytics, type FinishPhotoClaim } from '@underground/domain';
import {
  attemptPayload, localFinishCredit, localRouteHistory, pendingAttempts, recordLocalAttempt, resultSchema,
  saveLocalFinishPhoto, type AttemptRecord, type ResultDatabase,
} from './result-sql';

const database = new DatabaseSync(':memory:');
const db: ResultDatabase = {
  runAsync: async (sql: string, ...args: (string | number | null)[]) => database.prepare(sql).run(...args),
  getAllAsync: async <T,>(sql: string, ...args: (string | number | null)[]) => database.prepare(sql).all(...args) as T[],
};
const T0 = Date.UTC(2026, 10, 27, 16, 0, 0);
const analytics = computeRunAnalytics({ samples: [], activeMs: 900_000, distanceM: 12_000, startedAtMs: T0 });
const finish = { latitude: 36.27, longitude: -121.8 };
const run = (attempt: string, over: Partial<AttemptRecord> = {}): AttemptRecord => ({
  attempt, route: 'big-sur', outcome: 'completed', abortReason: null, progressM: 12_000, progressPct: 100,
  startedAtMs: T0, endedAtMs: T0 + 900_000, finishedAtMs: T0 + 900_000, durationMs: 900_000, finish,
  vehicleId: 'car-1', startLabel: '36.60, -121.90', analytics, ...over,
});
const aborted = (attempt: string, reason: 'traffic' | 'weather', at: number): AttemptRecord => run(attempt, {
  outcome: 'aborted', abortReason: reason, progressM: 3000, progressPct: 25, finishedAtMs: null, durationMs: null,
  finish: null, endedAtMs: at,
});
const photo = (kind: 'car' | 'dash', over: Partial<FinishPhotoClaim> = {}): FinishPhotoClaim => ({
  kind, takenAtMs: T0 + 960_000, latitude: finish.latitude, longitude: finish.longitude, accuracyM: 8, source: 'camera', ...over,
});

describe('run attempt log on the device', () => {
  beforeEach(() => {
    database.exec(resultSchema);
    database.exec('DELETE FROM run_attempts; DELETE FROM finish_photos;');
  });

  it('counts completions and aborts per route, idempotently', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    await recordLocalAttempt(db, 'a', run('a1'), true);
    await recordLocalAttempt(db, 'a', aborted('a2', 'traffic', T0 + 2e6), true);
    await recordLocalAttempt(db, 'a', aborted('a3', 'weather', T0 + 3e6), true);
    await recordLocalAttempt(db, 'a', run('a4', { endedAtMs: T0 + 4e6, durationMs: 880_000 }), true);
    await recordLocalAttempt(db, 'b', aborted('b1', 'traffic', T0), true);
    const history = await localRouteHistory(db, 'a', 'big-sur');
    expect(history).toMatchObject({ attempts: 4, completed: 2, aborted: 2, bestMs: 880_000, lastMs: 880_000 });
    expect(history.abortReasons).toEqual({ traffic: 1, weather: 1 });
    expect((await pendingAttempts(db, 'a')).length).toBe(4);
  });

  it('awards dash < car < both from saved photos', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'none' });
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash'), 'file:///dash.jpg', true);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'verified' });
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('car'), 'file:///car.jpg', true);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'top' });
    // Retaking the car photo far from the finish drops back to dash credit.
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('car', { latitude: 36.4 }), 'file:///car2.jpg', true);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'verified', car: 'off_location' });
  });

  it('sends only uploaded photos, never on aborted runs', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    const [row] = await pendingAttempts(db, 'a');
    const body = attemptPayload(row!, [
      { claim: photo('car'), storagePath: 'runs/a/a1/car.jpg' },
      { claim: photo('dash'), storagePath: null },
    ]);
    expect(body.photos).toEqual([{ ...photo('car'), storagePath: 'runs/a/a1/car.jpg' }]);
    expect(body.analytics).toEqual(analytics);
    await recordLocalAttempt(db, 'a', aborted('a2', 'traffic', T0 + 2e6), true);
    const abortRow = (await pendingAttempts(db, 'a')).find(r => r.attempt === 'a2')!;
    expect(attemptPayload(abortRow, [{ claim: photo('car'), storagePath: 'x' }]).photos).toEqual([]);
    expect(attemptPayload(abortRow, []).abortReason).toBe('traffic');
  });
});
