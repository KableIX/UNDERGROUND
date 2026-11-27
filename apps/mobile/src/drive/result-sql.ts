type BindValue = string | number | null;
export interface ResultDatabase {
  runAsync(sql: string, ...args: BindValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...args: BindValue[]): Promise<T[]>;
}
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
  `;

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

export async function localTopThree(db: ResultDatabase, member: string, route?: string): Promise<RecordRow[]> {
  if (route) return db.getAllAsync<RecordRow>(
    'SELECT attempt,route,name,millis,row_number() OVER (ORDER BY millis,member,attempt) AS place FROM finishes WHERE route=? ORDER BY millis,member,attempt LIMIT 3',route);
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
