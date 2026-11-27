type BindValue = string | number | null;
export interface ResultDatabase {
  runAsync(sql: string, ...args: BindValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...args: BindValue[]): Promise<T[]>;
}
import {
  finishCredit,
  summarizeRouteHistory,
  type FinishCredit,
  type FinishPhotoClaim,
  type FinishPhotoKind,
  type RouteHistory,
  type RunAbortReason,
  type RunAnalytics,
  type RunOutcome,
} from '@underground/domain';
import type { SessionMember } from '../session/types';
import type { RunFix } from './finish-proof';

export type RunResult = {kind: 'RUN'; route: string; attempt: string; duration: number; trace: RunFix[]};
export type CruiseResult = {kind: 'CRUISE'; route: string};
export type RecordRow = {attempt: string; route: string; name: string; millis: number; place: number};
export const resultSchema = `
    CREATE TABLE IF NOT EXISTS finishes (
      member TEXT NOT NULL, attempt TEXT NOT NULL, route TEXT NOT NULL,
      name TEXT NOT NULL, millis INTEGER NOT NULL CHECK(millis > 0),
      trace TEXT, PRIMARY KEY(member, attempt));
    CREATE INDEX IF NOT EXISTS finishes_by_route ON finishes(route,millis,member,attempt);
    CREATE INDEX IF NOT EXISTS finishes_by_member ON finishes(member,route,millis,attempt);
    CREATE TABLE IF NOT EXISTS personal_bests (
      member TEXT NOT NULL, route TEXT NOT NULL, attempt TEXT NOT NULL,
      PRIMARY KEY(member,route,attempt));
    CREATE TRIGGER IF NOT EXISTS save_personal_best AFTER INSERT ON finishes BEGIN
      DELETE FROM personal_bests WHERE member=NEW.member AND route=NEW.route;
      INSERT INTO personal_bests SELECT member,route,attempt FROM finishes
        WHERE member=NEW.member AND route=NEW.route ORDER BY millis,attempt LIMIT 3;
    END;
    INSERT OR IGNORE INTO personal_bests SELECT member,route,attempt FROM (
      SELECT member,route,attempt,row_number() OVER(PARTITION BY member,route ORDER BY millis,attempt) AS place
      FROM finishes) WHERE place<=3;
    CREATE TABLE IF NOT EXISTS cruises (
      member TEXT NOT NULL, route TEXT NOT NULL, pending INTEGER NOT NULL,
      PRIMARY KEY(member,route));
    CREATE TABLE IF NOT EXISTS run_attempts (
      member TEXT NOT NULL, attempt TEXT NOT NULL, route TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('completed','aborted')), abort_reason TEXT,
      progress_m REAL NOT NULL, progress_pct REAL NOT NULL,
      started_at INTEGER NOT NULL, ended_at INTEGER NOT NULL, finished_at INTEGER, duration_ms INTEGER,
      finish_lat REAL, finish_lng REAL, vehicle TEXT, start_label TEXT,
      analytics TEXT NOT NULL, pending INTEGER NOT NULL, credit_tier TEXT,
      PRIMARY KEY(member,attempt));
    CREATE INDEX IF NOT EXISTS run_attempts_by_route ON run_attempts(member,route,ended_at);
    CREATE TABLE IF NOT EXISTS finish_photos (
      member TEXT NOT NULL, attempt TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('car','dash')),
      uri TEXT NOT NULL, taken_at INTEGER NOT NULL, latitude REAL, longitude REAL, accuracy REAL,
      source TEXT NOT NULL, storage_path TEXT,
      PRIMARY KEY(member,attempt,kind));
  `;

/** One run attempt as logged on the device. Speed and time stay private to the member. */
export type AttemptRecord = {
  attempt: string;
  route: string;
  outcome: RunOutcome;
  abortReason: RunAbortReason | null;
  progressM: number;
  progressPct: number;
  startedAtMs: number;
  endedAtMs: number;
  /** GPS finish time (completed runs). */
  finishedAtMs: number | null;
  /** Route-verified completion time (completed runs). */
  durationMs: number | null;
  finish: {latitude: number; longitude: number} | null;
  vehicleId: string | null;
  startLabel: string | null;
  analytics: RunAnalytics;
};

type AttemptRow = {
  member: string; attempt: string; route: string; outcome: RunOutcome; abort_reason: RunAbortReason | null;
  progress_m: number; progress_pct: number; started_at: number; ended_at: number; finished_at: number | null;
  duration_ms: number | null; finish_lat: number | null; finish_lng: number | null; vehicle: string | null;
  start_label: string | null; analytics: string; pending: number; credit_tier: string | null;
};
type PhotoRow = {
  kind: FinishPhotoKind; uri: string; taken_at: number; latitude: number | null; longitude: number | null;
  accuracy: number | null; source: 'camera' | 'library'; storage_path: string | null;
};

export async function recordLocalAttempt(db: ResultDatabase, member: string, a: AttemptRecord, live: boolean) {
  await db.runAsync(`INSERT OR IGNORE INTO run_attempts(member,attempt,route,outcome,abort_reason,progress_m,progress_pct,
      started_at,ended_at,finished_at,duration_ms,finish_lat,finish_lng,vehicle,start_label,analytics,pending)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    member, a.attempt, a.route, a.outcome, a.abortReason, a.progressM, a.progressPct, a.startedAtMs, a.endedAtMs,
    a.finishedAtMs, a.durationMs, a.finish?.latitude ?? null, a.finish?.longitude ?? null, a.vehicleId, a.startLabel,
    JSON.stringify(a.analytics), Number(live));
}

/** Save (or replace) the member's finish photo of one kind. `uri` must already be location-stripped. */
export async function saveLocalFinishPhoto(db: ResultDatabase, member: string, attempt: string, claim: FinishPhotoClaim, uri: string, live: boolean) {
  await db.runAsync(`INSERT OR REPLACE INTO finish_photos(member,attempt,kind,uri,taken_at,latitude,longitude,accuracy,source,storage_path)
      VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
    member, attempt, claim.kind, uri, claim.takenAtMs, claim.latitude, claim.longitude, claim.accuracyM, claim.source);
  if (live) await db.runAsync('UPDATE run_attempts SET pending=1 WHERE member=? AND attempt=?', member, attempt);
}

export async function localFinishPhotos(db: ResultDatabase, member: string, attempt: string) {
  const rows = await db.getAllAsync<PhotoRow>(
    'SELECT kind,uri,taken_at,latitude,longitude,accuracy,source,storage_path FROM finish_photos WHERE member=? AND attempt=? ORDER BY kind', member, attempt);
  return rows.map(row => ({
    uri: row.uri,
    storagePath: row.storage_path,
    claim: {kind: row.kind, takenAtMs: row.taken_at, latitude: row.latitude, longitude: row.longitude, accuracyM: row.accuracy, source: row.source} as FinishPhotoClaim,
  }));
}

/** Credit as the device sees it. The server recomputes it; this is for the member's own screen. */
export async function localFinishCredit(db: ResultDatabase, member: string, attempt: string): Promise<FinishCredit | null> {
  const [row] = await db.getAllAsync<AttemptRow>('SELECT * FROM run_attempts WHERE member=? AND attempt=?', member, attempt);
  if (!row || row.outcome !== 'completed' || row.finished_at == null || row.finish_lat == null || row.finish_lng == null) return null;
  const photos = await localFinishPhotos(db, member, attempt);
  return finishCredit(photos.map(p => p.claim), {latitude: row.finish_lat, longitude: row.finish_lng, finishedAtMs: row.finished_at}, true);
}

export async function localRouteHistory(db: ResultDatabase, member: string, route: string): Promise<RouteHistory> {
  const rows = await db.getAllAsync<Pick<AttemptRow, 'route' | 'outcome' | 'ended_at' | 'duration_ms' | 'abort_reason'>>(
    'SELECT route,outcome,ended_at,duration_ms,abort_reason FROM run_attempts WHERE member=? AND route=? ORDER BY ended_at', member, route);
  return summarizeRouteHistory(rows.map(r => ({route: r.route, outcome: r.outcome, endedAtMs: r.ended_at, durationMs: r.duration_ms, abortReason: r.abort_reason})), route);
}

export async function pendingAttempts(db: ResultDatabase, member: string) {
  return db.getAllAsync<AttemptRow>('SELECT * FROM run_attempts WHERE member=? AND pending=1 ORDER BY ended_at', member);
}

/**
 * 90-day retention on the device: speed-derived detail is removed from local run analytics
 * of attempts that ended before the cutoff. Summary (avg speed, time, distance) stays.
 */
export async function purgeLocalRunAnalytics(db: ResultDatabase, cutoffMs: number) {
  await db.runAsync(
    `UPDATE run_attempts SET analytics=json_set(analytics,'$.maxSpeedMps',json('null'),'$.avgMovingSpeedMps',json('null'))
     WHERE ended_at < ? AND (json_extract(analytics,'$.maxSpeedMps') IS NOT NULL OR json_extract(analytics,'$.avgMovingSpeedMps') IS NOT NULL)`,
    cutoffMs);
}

/** Body for POST /v1/run-attempts. Photos are included only once uploaded (stripped). */
export function attemptPayload(row: AttemptRow, photos: Array<{claim: FinishPhotoClaim; storagePath: string | null}>) {
  return {
    attempt: row.attempt,
    route: row.route,
    outcome: row.outcome,
    abortReason: row.abort_reason,
    progressM: row.progress_m,
    progressPct: row.progress_pct,
    startedAtMs: row.started_at,
    endedAtMs: row.ended_at,
    finishedAtMs: row.finished_at,
    vehicleId: row.vehicle,
    startLabel: row.start_label,
    analytics: JSON.parse(row.analytics) as RunAnalytics,
    photos: row.outcome === 'completed'
      ? photos.filter(p => p.storagePath).map(p => ({...p.claim, storagePath: p.storagePath!}))
      : [],
  };
}

export async function recordLocalResult(db: ResultDatabase, member: Pick<SessionMember,'memberId'|'displayName'>, result: RunResult | CruiseResult, live: boolean) {
  if (result.kind === 'CRUISE') {
    await db.runAsync('INSERT OR IGNORE INTO cruises(member,route,pending) VALUES (?,?,?)',
      member.memberId, result.route, Number(live));
  } else {
    await db.runAsync('INSERT OR IGNORE INTO finishes(member,attempt,route,name,millis,trace) VALUES (?,?,?,?,?,?)',
      member.memberId, result.attempt, result.route, member.displayName, result.duration,
      live ? JSON.stringify(result.trace) : null);
  }
}

/** Your own best three per route. Times are private: never ranked against other members. */
export async function localTopThree(db: ResultDatabase, member: string, route?: string): Promise<RecordRow[]> {
  if (route) return db.getAllAsync<RecordRow>(
    'SELECT attempt,route,name,millis,row_number() OVER (ORDER BY millis,attempt) AS place FROM finishes WHERE member=? AND route=? ORDER BY millis,attempt LIMIT 3',member,route);
  return db.getAllAsync<RecordRow>(`SELECT * FROM (
    SELECT attempt,route,name,millis,row_number() OVER(PARTITION BY route ORDER BY millis,attempt) AS place
    FROM personal_bests JOIN finishes USING(member,route,attempt) WHERE member=?) WHERE place<=3 ORDER BY route,place`,member);
}

export function mergePersonalTimes(remote: RecordRow[], local: RecordRow[]): RecordRow[] {
  const attempts = new Map<string, RecordRow>();
  for (const row of [...local,...remote]) attempts.set(row.attempt, row);
  const ordered = [...attempts.values()].sort((a,b) => a.route.localeCompare(b.route) ||
    a.millis - b.millis || (a.attempt < b.attempt ? -1 : a.attempt > b.attempt ? 1 : 0));
  let previous = '', place = 0;
  return ordered.flatMap(row => {
    if (row.route !== previous) { previous = row.route; place = 0; }
    place++;
    return place <= 3 ? [{...row,place}] : [];
  });
}
