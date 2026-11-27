import type { SQLiteDatabase } from 'expo-sqlite';
import { publicEnv } from '../lib/env';
import { getMobileSupabaseClient, isLiveAuthConfigured } from '../session/supabase-session';
import type { SessionMember } from '../session/types';
import { resultSchema, recordLocalResult, localTopThree, mergePersonalTimes, type CruiseResult, type RunResult, type RecordRow,
  recordLocalAttempt, saveLocalFinishPhoto, purgeLocalRunAnalytics, localFinishPhotos, localFinishCredit, localRouteHistory, pendingAttempts, attemptPayload,
  type AttemptRecord } from './result-sql';
import { rawTrackCutoffMs, type FinishPhotoClaim, type RouteHistory } from '@underground/domain';
import { getTripStore } from './trip-store';
import { uploadRunPhoto } from './finish-photo-upload';
export type { RecordRow, AttemptRecord } from './result-sql';

type Pending = {route: string; attempt: string | null; trace: string | null};
const listeners = new Set<() => void>();
export function onResultChange(callback: () => void) {
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}
function notify() { listeners.forEach(callback => callback()); }

let connection: Promise<SQLiteDatabase> | undefined;
async function openStore() {
  const sqlite = require('expo-sqlite') as typeof import('expo-sqlite');
  const db = await sqlite.openDatabaseAsync(isLiveAuthConfigured() ? 'route-results.db' : 'preview-route-results.db');
  await db.execAsync(resultSchema);
  return db;
}
function database() {
  return connection ??= openStore().catch(error => { connection = undefined; throw error; });
}

export async function saveResult(member: SessionMember, result: RunResult | CruiseResult) {
  const db = await database();
  const live = isLiveAuthConfigured();
  await recordLocalResult(db,member,result,live);
  notify();
  if (live) void syncResults(member.memberId).catch(() => undefined);
}

const syncing = new Map<string, Promise<void>>();
const rerun = new Set<string>();
export function syncResults(member: string): Promise<void> {
  if (!isLiveAuthConfigured()) return Promise.resolve();
  const running = syncing.get(member);
  if (running) { rerun.add(member); return running; }
  const job = (async () => {
    do {
      rerun.delete(member);
      const db = await database();
      const pending = await db.getAllAsync<Pending>(
        'SELECT route,attempt,trace FROM finishes WHERE member=? AND trace IS NOT NULL UNION ALL SELECT route,NULL,NULL FROM cruises WHERE member=? AND pending=1', member, member);
      const attemptsWaiting = await pendingAttempts(db, member);
      if (!pending.length && !attemptsWaiting.length) return;
      const client = getMobileSupabaseClient();
      const token = (await client?.auth.getSession())?.data.session?.access_token;
      if (!token) return;
      // A queued result belongs to the member who finished, including across sign-outs.
      const headers = {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'};
      const base = publicEnv.API_PUBLIC_URL!.replace(/\/$/, '');
      const who = await fetch(base + '/v1/me', {headers});
      if (!who.ok || (await who.json()).profile?.member?.id !== member) return;
      for (const row of pending) {
        const payload = row.attempt ? {kind: 'RUN', route: row.route, attempt: row.attempt, trace: JSON.parse(row.trace!)}
          : {kind: 'CRUISE', route: row.route};
        const response = await fetch(base + '/v1/route-finishes', {method: 'POST', headers, body: JSON.stringify(payload)});
        if (!response.ok) continue;
        if (row.attempt) await db.runAsync('UPDATE finishes SET trace=NULL WHERE member=? AND attempt=?', member, row.attempt);
        else await db.runAsync('UPDATE cruises SET pending=0 WHERE member=? AND route=?', member, row.route);
        notify();
      }
      // Attempts after finishes: finish credit references the server-validated finish.
      await syncAttempts(db, member, base, headers, token);
    } while (rerun.has(member));
  })().finally(() => { syncing.delete(member); rerun.delete(member); });
  syncing.set(member, job);
  return job;
}

export async function cruiseCompleted(member: string, route: string) {
  const db = await database();
  if (await db.getFirstAsync('SELECT 1 FROM cruises WHERE member=? AND route=?', member, route)) return true;
  if (!isLiveAuthConfigured()) return false;
  const client = getMobileSupabaseClient();
  if (!client) throw Error('Club connection unavailable');
  const {data,error} = await client.from('cruise_completions').select('route_slug').eq('member_id',member).eq('route_slug',route).maybeSingle();
  if (error) throw error;
  if (data) await db.runAsync('INSERT OR IGNORE INTO cruises VALUES(?,?,0)',member,route);
  return !!data;
}

/** Your own best times (all routes, or one). Private: never compared with other members. */
export async function readTimes(member: string, route?: string): Promise<RecordRow[]> {
  const db = await database();
  const local = await localTopThree(db,member,route);
  if (!isLiveAuthConfigured()) return local;
  const client = getMobileSupabaseClient();
  try {
    if (!client) throw Error('Club connection unavailable');
    const {data,error} = await client.rpc('my_run_top_threes');
    if (error) throw error;
    const mine = ((data ?? []) as RecordRow[]).filter(row => !route || row.route === route);
    return mergePersonalTimes(mine,local);
  } catch (error) {
    if (local.length) return local;
    throw error;
  }
}

type Db = Awaited<ReturnType<typeof database>>;
async function syncAttempts(db: Db, member: string, base: string, headers: Record<string, string>, token: string) {
  for (const row of await pendingAttempts(db, member)) {
    const photos = await localFinishPhotos(db, member, row.attempt);
    if (row.outcome === 'completed') {
      for (const photo of photos) {
        if (photo.storagePath) continue;
        const path = await uploadRunPhoto({base, token, attempt: row.attempt, kind: photo.claim.kind, uri: photo.uri});
        if (!path) continue;
        await db.runAsync('UPDATE finish_photos SET storage_path=? WHERE member=? AND attempt=? AND kind=?', path, member, row.attempt, photo.claim.kind);
        photo.storagePath = path;
      }
    }
    const response = await fetch(base + '/v1/run-attempts', {method: 'POST', headers, body: JSON.stringify(attemptPayload(row, photos))});
    // 409: the finish or a photo has not reached the server yet. Retry on the next sync.
    // 404: this API has not been deployed with the run log yet. Keep it queued.
    if (!response.ok && response.status !== 422) continue;
    const body = await response.json().catch(() => null) as {ok?: boolean; credit?: {tier: string} | null} | null;
    const allUploaded = photos.every(photo => photo.storagePath);
    // 422 means the server will never accept this record; stop retrying it (-1).
    const pending = response.ok ? (allUploaded ? 0 : 1) : -1;
    await db.runAsync('UPDATE run_attempts SET pending=?, credit_tier=? WHERE member=? AND attempt=?',
      pending, body?.credit?.tier ?? null, member, row.attempt);
    notify();
  }
}

/** Log a completed or ended run on the device, then sync it privately to the club backend. */
export async function recordAttempt(member: string, attempt: AttemptRecord) {
  const db = await database();
  const live = isLiveAuthConfigured();
  await recordLocalAttempt(db, member, attempt, live);
  notify();
  if (live) void syncResults(member).catch(() => undefined);
}

/** Store a location-stripped finish photo and its private capture metadata. */
export async function addFinishPhoto(member: string, attempt: string, claim: FinishPhotoClaim, strippedUri: string) {
  const db = await database();
  const live = isLiveAuthConfigured();
  await saveLocalFinishPhoto(db, member, attempt, claim, strippedUri, live);
  notify();
  if (live) void syncResults(member).catch(() => undefined);
  return localFinishCredit(db, member, attempt);
}

export async function readFinishCredit(member: string, attempt: string) {
  return localFinishCredit(await database(), member, attempt);
}

export async function readFinishPhotos(member: string, attempt: string) {
  return localFinishPhotos(await database(), member, attempt);
}

/** Your own history on one route: completions, aborts and your trend. Never compared with anyone. */
export async function readRouteHistory(member: string, route: string): Promise<RouteHistory> {
  const local = await localRouteHistory(await database(), member, route);
  if (!isLiveAuthConfigured()) return local;
  try {
    const client = getMobileSupabaseClient();
    if (!client) return local;
    const {data, error} = await client.rpc('my_route_history', {target_route: route});
    const remote = (data as Array<{completed: number; aborted: number; best_ms: number | null}> | null)?.[0];
    if (error || !remote) return local;
    // Another device may have logged runs this one has not seen.
    return {
      ...local,
      completed: Math.max(local.completed, Number(remote.completed)),
      aborted: Math.max(local.aborted, Number(remote.aborted)),
      attempts: Math.max(local.attempts, Number(remote.completed) + Number(remote.aborted)),
      bestMs: [local.bestMs, remote.best_ms == null ? null : Number(remote.best_ms)]
        .filter((v): v is number => v != null).reduce<number | null>((a, b) => a == null ? b : Math.min(a, b), null),
    };
  } catch {
    return local;
  }
}

/** 90-day retention on the device: drop raw GPS samples of old trips and speed detail of old runs. */
export async function purgeLocalRawRunData(nowMs: number = Date.now()) {
  const cutoff = rawTrackCutoffMs(nowMs);
  const store = getTripStore() as { purgeRawSamples?: (cutoffMs: number) => Promise<number> };
  await store.purgeRawSamples?.(cutoff);
  await purgeLocalRunAnalytics(await database(), cutoff);
}
