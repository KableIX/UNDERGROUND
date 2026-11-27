import { beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { computeRunAnalytics, type FinishPhotoClaim } from '@underground/domain';
import {
  attemptPayload, attemptReady, cameraState, localFinishCredit, localFinishPhotos, localRouteHistory, localRunPhotos, parseFinishNonce, parseTopThree, pendingAttempts,
  readLocalFinishNonce, saveFinishNonce,
  recordLocalAttempt, resultSchema, resultUpgrades, saveLocalFinishPhoto, settleAttempt, purgeLocalRunAnalytics,
  type AttemptRecord, type ResultDatabase,
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

  it('sends a non-image proof only, never on aborted runs', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    const [row] = await pendingAttempts(db, 'a');
    const body = attemptPayload(row!, [
      { claim: photo('car'), imageSha256: 'c'.repeat(64) },
      { claim: photo('dash'), imageSha256: null },
    ]);
    expect(body.photos).toEqual([{ ...photo('car'), imageSha256: 'c'.repeat(64) }, { ...photo('dash'), imageSha256: null }]);
    expect(JSON.stringify(body)).not.toMatch(/file:|storagePath|base64/);
    expect(body.analytics).toEqual(analytics);
    await recordLocalAttempt(db, 'a', aborted('a2', 'traffic', T0 + 2e6), true);
    const abortRow = (await pendingAttempts(db, 'a')).find(r => r.attempt === 'a2')!;
    expect(attemptPayload(abortRow, [{ claim: photo('car'), imageSha256: null }]).photos).toEqual([]);
    expect(attemptPayload(abortRow, []).abortReason).toBe('traffic');
  });
});

describe('finish photos stay on the phone; location goes once accepted', () => {
  beforeEach(() => {
    database.exec(resultSchema);
    database.exec('DELETE FROM run_attempts; DELETE FROM finish_photos;');
  });
  const WINDOW = 30 * 60_000;

  it('waits for a final photo set before sending a completed run', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    const [row] = await pendingAttempts(db, 'a');
    const finishedAt = row!.finished_at!;
    expect(attemptReady(row!, [], finishedAt + 60_000)).toBe(false);
    expect(attemptReady(row!, [{ claim: photo('dash') }], finishedAt + 60_000)).toBe(false);
    expect(attemptReady(row!, [{ claim: photo('dash') }, { claim: photo('car') }], finishedAt + 60_000)).toBe(true);
    expect(attemptReady(row!, [], finishedAt + WINDOW)).toBe(true);
    expect(attemptReady({ outcome: 'aborted', finished_at: null }, [], 0)).toBe(true);
  });

  it('keeps the credit result and deletes the capture location after acceptance', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash'), 'file:///docs/finish-photos/dash.jpg', true, 'd'.repeat(64));
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('car'), 'file:///docs/finish-photos/car.jpg', true, 'c'.repeat(64));
    await settleAttempt(db, 'a', 'a1', 0, { tier: 'top', points: 30 });
    const stored = database.prepare("SELECT latitude, longitude, accuracy, uri, image_sha256 FROM finish_photos WHERE attempt='a1' ORDER BY kind").all();
    expect(stored).toEqual([
      { latitude: null, longitude: null, accuracy: null, uri: 'file:///docs/finish-photos/car.jpg', image_sha256: 'c'.repeat(64) },
      { latitude: null, longitude: null, accuracy: null, uri: 'file:///docs/finish-photos/dash.jpg', image_sha256: 'd'.repeat(64) },
    ]);
    expect(await localFinishCredit(db, 'a', 'a1')).toEqual({ tier: 'top', points: 30, car: 'accepted', dash: 'accepted', final: true });
    expect((await pendingAttempts(db, 'a')).length).toBe(0);
    // A retake after the credit is final is kept as a photo, without location, and changes nothing.
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('car', { latitude: 36.4 }), 'file:///docs/finish-photos/car2.jpg', true, 'e'.repeat(64));
    expect((await localFinishPhotos(db, 'a', 'a1')).find(p => p.claim.kind === 'car')!.claim.latitude).toBeNull();
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'top', final: true });
    expect((await pendingAttempts(db, 'a')).length).toBe(0);
  });

  it('a refused run keeps no credit and no location', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash'), 'file:///dash.jpg', true);
    await settleAttempt(db, 'a', 'a1', -1, null);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'none', points: 0, final: true });
    expect(database.prepare("SELECT latitude FROM finish_photos WHERE attempt='a1'").get()).toEqual({ latitude: null });
  });

  it('lists the member\'s photos for in-app photos, newest first', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), false);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash', { takenAtMs: T0 + 1 }), 'file:///d.jpg', false);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('car', { takenAtMs: T0 + 2 }), 'file:///c.jpg', false);
    await saveLocalFinishPhoto(db, 'b', 'b1', photo('car'), 'file:///other.jpg', false);
    expect(await localRunPhotos(db, 'a')).toEqual([
      { attempt: 'a1', route: 'big-sur', kind: 'car', uri: 'file:///c.jpg', takenAtMs: T0 + 2 },
      { attempt: 'a1', route: 'big-sur', kind: 'dash', uri: 'file:///d.jpg', takenAtMs: T0 + 1 },
    ]);
  });

  it('upgrades an older device database once', () => {
    const old = new DatabaseSync(':memory:');
    old.exec(`CREATE TABLE run_attempts (member TEXT, attempt TEXT, credit_tier TEXT);
      CREATE TABLE finish_photos (member TEXT, attempt TEXT, kind TEXT, storage_path TEXT);`);
    for (const sql of resultUpgrades) old.exec(sql);
    for (const sql of resultUpgrades) expect(() => old.exec(sql)).toThrow(/duplicate column/);
    expect((old.prepare('PRAGMA table_info(finish_photos)').all() as Array<{ name: string }>).map(c => c.name)).toContain('image_sha256');
  });
});

describe('route all-time top 3', () => {
  it('shows username and time, top 3 only, in place order', () => {
    expect(parseTopThree([
      { place: 2, username: 'APEX', duration_ms: '800000' },
      { place: 1, username: 'STARK', duration_ms: 700000 },
      { place: 3, username: 'NIGHTOWL', duration_ms: 800000 },
      { place: 4, username: 'EXTRA', duration_ms: 900000 },
      { place: 0, username: '', duration_ms: 1 },
    ])).toEqual([
      { place: 1, username: 'STARK', millis: 700000 },
      { place: 2, username: 'APEX', millis: 800000 },
      { place: 3, username: 'NIGHTOWL', millis: 800000 },
    ]);
    expect(parseTopThree(null)).toEqual([]);
  });
});

describe('90-day retention on the device', () => {
  beforeEach(() => {
    database.exec(resultSchema);
    database.exec('DELETE FROM run_attempts; DELETE FROM finish_photos;');
  });
  it('drops speed detail from old runs and keeps the summary', async () => {
    const detailed = { ...analytics, maxSpeedMps: 31.2, avgMovingSpeedMps: 14.5, avgSpeedMps: 13.3 };
    await recordLocalAttempt(db, 'a', run('old', { endedAtMs: T0, analytics: detailed }), false);
    await recordLocalAttempt(db, 'a', run('new', { endedAtMs: T0 + 100 * 86_400_000, analytics: detailed }), false);
    await purgeLocalRunAnalytics(db, T0 + 10 * 86_400_000);
    const rows = database.prepare('SELECT attempt, analytics FROM run_attempts ORDER BY attempt').all() as Array<{ attempt: string; analytics: string }>;
    const byId = Object.fromEntries(rows.map(r => [r.attempt, JSON.parse(r.analytics)]));
    expect(byId.old).toMatchObject({ maxSpeedMps: null, avgMovingSpeedMps: null, avgSpeedMps: 13.3, activeMs: 900_000, distanceM: 12_000 });
    expect(byId.new).toMatchObject({ maxSpeedMps: 31.2, avgMovingSpeedMps: 14.5 });
  });
});

describe('finish nonce on the device', () => {
  beforeEach(() => {
    database.exec(resultSchema);
    database.exec('DELETE FROM run_attempts; DELETE FROM finish_photos; DELETE FROM finish_nonces;');
  });
  const issued = { token: 'tok.sig', issuedAtMs: T0 + 900_000 + 20_000, finishedAtMs: T0 + 900_000, expiresAtMs: T0 + 900_000 + 45 * 60_000 };

  it('keeps the first nonce and sends it with the completed run only', async () => {
    expect(parseFinishNonce(issued)).toEqual(issued);
    expect(parseFinishNonce({ token: '', issuedAtMs: 1, finishedAtMs: 1, expiresAtMs: 1 })).toBeNull();
    await saveFinishNonce(db, 'a', 'a1', issued);
    await saveFinishNonce(db, 'a', 'a1', { ...issued, token: 'second' });
    expect(await readLocalFinishNonce(db, 'a', 'a1')).toEqual(issued);
    await recordLocalAttempt(db, 'a', run('a1'), true);
    const [row] = await pendingAttempts(db, 'a');
    expect(attemptPayload(row!, [], issued.token).finishNonce).toBe('tok.sig');
    await recordLocalAttempt(db, 'a', aborted('a2', 'traffic', T0 + 2e6), true);
    const abortRow = (await pendingAttempts(db, 'a')).find(r => r.attempt === 'a2')!;
    expect(attemptPayload(abortRow, [], 'tok').finishNonce).toBeNull();
  });

  it('opens the camera only once the nonce arrived, until it expires', () => {
    expect(cameraState(null, true, T0)).toBe('waiting');
    expect(cameraState(issued, true, issued.issuedAtMs)).toBe('ready');
    expect(cameraState(issued, true, issued.expiresAtMs + 1)).toBe('expired');
    expect(cameraState(null, false, T0)).toBe('ready'); // preview mode
  });

  it('shows library or pre-nonce photos as earning nothing', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    await saveFinishNonce(db, 'a', 'a1', issued);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash', { takenAtMs: issued.issuedAtMs + 60_000 }), 'file:///d.jpg', true);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('car', { source: 'library', takenAtMs: issued.issuedAtMs + 60_000 }), 'file:///c.jpg', true);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'verified', car: 'library', dash: 'accepted' });
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash', { takenAtMs: issued.issuedAtMs - 60_000 }), 'file:///d2.jpg', true);
    expect(await localFinishCredit(db, 'a', 'a1')).toMatchObject({ tier: 'none', dash: 'early' });
  });

  it('settles with the server\'s photo statuses', async () => {
    await recordLocalAttempt(db, 'a', run('a1'), true);
    await saveLocalFinishPhoto(db, 'a', 'a1', photo('dash'), 'file:///d.jpg', true);
    await settleAttempt(db, 'a', 'a1', 0, { tier: 'none', points: 0, car: null, dash: 'unverified', proofError: 'attestation_required' });
    expect(await localFinishCredit(db, 'a', 'a1')).toEqual({ tier: 'none', points: 0, car: null, dash: 'unverified', final: true });
  });
});

