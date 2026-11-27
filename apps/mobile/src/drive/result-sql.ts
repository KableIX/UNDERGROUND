type BindValue = string | number | null;
export interface ResultDatabase {
  runAsync(sql: string, ...args: BindValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...args: BindValue[]): Promise<T[]>;
}
import {
  FINISH_PHOTO_WINDOW_MS,
  finishCredit,
  summarizeRouteHistory,
  type FinishCredit,
  type FinishPhotoClaim,
  type FinishPhotoKind,
  type FinishPhotoProof,
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
      analytics TEXT NOT NULL, pending INTEGER NOT NULL, credit_tier TEXT, credit TEXT,
      PRIMARY KEY(member,attempt));
    CREATE INDEX IF NOT EXISTS run_attempts_by_route ON run_attempts(member,route,ended_at);
    CREATE TABLE IF NOT EXISTS finish_photos (
      member TEXT NOT NULL, attempt TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('car','dash')),
      uri TEXT NOT NULL, taken_at INTEGER NOT NULL, latitude REAL, longitude REAL, accuracy REAL,
      source TEXT NOT NULL, storage_path TEXT, image_sha256 TEXT,
      PRIMARY KEY(member,attempt,kind));
  `;

/** Columns added after the first run-log schema. Each runs once; "duplicate column" is ignored. */
export const resultUpgrades = [
  'ALTER TABLE run_attempts ADD COLUMN credit TEXT',
  'ALTER TABLE finish_photos ADD COLUMN image_sha256 TEXT',
];

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
  start_label: string | null; analytics: string; pending: number; credit_tier: string | null; credit: string | null;
};
type PhotoRow = {
  kind: FinishPhotoKind; uri: string; taken_at: number; latitude: number | null; longitude: number | null;
  accuracy: number | null; source: 'camera' | 'library'; image_sha256: string | null;
};
/** A finish photo as kept on this phone. The image file never leaves the device. */
export type LocalFinishPhoto = { uri: string; imageSha256: string | null; claim: FinishPhotoClaim };
/** Credit as shown on the phone. `final` once the club accepted it (photo location then deleted). */
export type LocalFinishCredit = FinishCredit & { final?: boolean };

export async function recordLocalAttempt(db: ResultDatabase, member: string, a: AttemptRecord, live: boolean) {
  await db.runAsync(`INSERT OR IGNORE INTO run_attempts(member,attempt,route,outcome,abort_reason,progress_m,progress_pct,
      started_at,ended_at,finished_at,duration_ms,finish_lat,finish_lng,vehicle,start_label,analytics,pending)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    member, a.attempt, a.route, a.outcome, a.abortReason, a.progressM, a.progressPct, a.startedAtMs, a.endedAtMs,
    a.finishedAtMs, a.durationMs, a.finish?.latitude ?? null, a.finish?.longitude ?? null, a.vehicleId, a.startLabel,
    JSON.stringify(a.analytics), Number(live));
}

/**
 * Save (or replace) the member's finish photo of one kind, on this phone only. `uri` must
 * already be location-stripped. After the credit is final the photo is still kept, but its
 * capture location is not: it can no longer change the credit.
 */
export async function saveLocalFinishPhoto(db: ResultDatabase, member: string, attempt: string, claim: FinishPhotoClaim, uri: string, live: boolean, imageSha256: string | null = null) {
  const [row] = await db.getAllAsync<{credit: string | null}>('SELECT credit FROM run_attempts WHERE member=? AND attempt=?', member, attempt);
  const final = !!row?.credit;
  await db.runAsync(`INSERT OR REPLACE INTO finish_photos(member,attempt,kind,uri,taken_at,latitude,longitude,accuracy,source,storage_path,image_sha256)
      VALUES (?,?,?,?,?,?,?,?,?,NULL,?)`,
    member, attempt, claim.kind, uri, claim.takenAtMs,
    final ? null : claim.latitude, final ? null : claim.longitude, final ? null : claim.accuracyM, claim.source, imageSha256);
  if (live && !final) await db.runAsync('UPDATE run_attempts SET pending=1 WHERE member=? AND attempt=?', member, attempt);
}

export async function localFinishPhotos(db: ResultDatabase, member: string, attempt: string): Promise<LocalFinishPhoto[]> {
  const rows = await db.getAllAsync<PhotoRow>(
    'SELECT kind,uri,taken_at,latitude,longitude,accuracy,source,image_sha256 FROM finish_photos WHERE member=? AND attempt=? ORDER BY kind', member, attempt);
  return rows.map(row => ({
    uri: row.uri,
    imageSha256: row.image_sha256,
    claim: {kind: row.kind, takenAtMs: row.taken_at, latitude: row.latitude, longitude: row.longitude, accuracyM: row.accuracy, source: row.source} as FinishPhotoClaim,
  }));
}

/** Every finish photo on this phone, newest first, for the member's in-app photos. */
export type RunPhoto = {attempt: string; route: string | null; kind: FinishPhotoKind; uri: string; takenAtMs: number};
export async function localRunPhotos(db: ResultDatabase, member: string): Promise<RunPhoto[]> {
  const rows = await db.getAllAsync<{attempt: string; route: string | null; kind: FinishPhotoKind; uri: string; taken_at: number}>(
    `SELECT p.attempt, a.route, p.kind, p.uri, p.taken_at FROM finish_photos p
     LEFT JOIN run_attempts a ON a.member=p.member AND a.attempt=p.attempt
     WHERE p.member=? ORDER BY p.taken_at DESC, p.kind`, member);
  return rows.map(r => ({attempt: r.attempt, route: r.route, kind: r.kind, uri: r.uri, takenAtMs: r.taken_at}));
}

/** Credit as the device sees it. The server recomputes it; this is for the member's own screen. */
export async function localFinishCredit(db: ResultDatabase, member: string, attempt: string): Promise<LocalFinishCredit | null> {
  const [row] = await db.getAllAsync<AttemptRow>('SELECT * FROM run_attempts WHERE member=? AND attempt=?', member, attempt);
  if (!row || row.outcome !== 'completed' || row.finished_at == null || row.finish_lat == null || row.finish_lng == null) return null;
  if (row.credit) return {...(JSON.parse(row.credit) as FinishCredit), final: true};
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

/**
 * Completed runs are sent once their photo set is final: both photos taken, or the photo
 * window closed. That way the credit is decided once and the location can be deleted.
 */
export function attemptReady(row: Pick<AttemptRow, 'outcome' | 'finished_at'>, photos: Array<{claim: FinishPhotoClaim}>, nowMs: number) {
  if (row.outcome !== 'completed' || row.finished_at == null) return true;
  const kinds = new Set(photos.map(p => p.claim.kind));
  return (kinds.has('car') && kinds.has('dash')) || nowMs >= row.finished_at + FINISH_PHOTO_WINDOW_MS;
}

/**
 * The club accepted (or finally refused) this attempt. Keep only the credit result and delete
 * the photo capture location on this phone too. Photos themselves stay in the member's app.
 */
export async function settleAttempt(db: ResultDatabase, member: string, attempt: string, pending: 0 | -1, server: {tier: string; points: number} | null) {
  const local = await localFinishCredit(db, member, attempt);
  // The server's tier and points are the result. Refused (or no photos): no credit.
  const credit = local && !local.final
    ? {...local, tier: (server?.tier ?? 'none') as FinishCredit['tier'], points: server?.points ?? 0}
    : null;
  await db.runAsync('UPDATE run_attempts SET pending=?, credit_tier=?, credit=coalesce(credit, ?) WHERE member=? AND attempt=?',
    pending, server?.tier ?? null, credit ? JSON.stringify({tier: credit.tier, points: credit.points, car: credit.car, dash: credit.dash}) : null, member, attempt);
  await db.runAsync('UPDATE finish_photos SET latitude=NULL, longitude=NULL, accuracy=NULL WHERE member=? AND attempt=?', member, attempt);
}

/** Body for POST /v1/run-attempts. Photos are sent as non-image proof only; images stay on the phone. */
export function attemptPayload(row: AttemptRow, photos: Array<{claim: FinishPhotoClaim; imageSha256: string | null}>) {
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
      ? photos.map((p): FinishPhotoProof => ({...p.claim, imageSha256: p.imageSha256}))
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

/**
 * The all-time top 3 on a route (route_all_time_top_three): each member's single best accepted
 * time with their username. Members only, from the club server; empty offline or in preview.
 */
export type TopRunner = {place: number; username: string; millis: number};
export function parseTopThree(data: unknown): TopRunner[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap(row => {
    const r = row as {place?: unknown; username?: unknown; duration_ms?: unknown};
    const place = Number(r.place), millis = Number(r.duration_ms);
    if (typeof r.username !== 'string' || !r.username || !Number.isInteger(place) || place < 1 || !(millis > 0)) return [];
    return [{place, username: r.username, millis}];
  }).sort((a, b) => a.place - b.place).slice(0, 3);
}
