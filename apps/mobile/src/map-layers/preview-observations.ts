import type { SQLiteDatabase } from 'expo-sqlite';

export type Observation = 'speed_check' | 'patrol' | 'traffic_control';
let connection: Promise<SQLiteDatabase> | undefined;
async function open() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite=require('expo-sqlite') as typeof import('expo-sqlite');
  const db=await sqlite.openDatabaseAsync('preview-road-observations.db');
  await db.execAsync(`create table if not exists observations (
    member text not null, route text not null, kind text not null, segment integer not null,
    day text not null, captured integer not null, primary key(member,route,kind,segment,day)
  )`);
  return db;
}
function store(){return connection ??= open().catch(error=>{connection=undefined;throw error;});}
const windowMs=90*86400000;
export async function saveObservation(member:string,route:string,kind:Observation,meters:number,captured:number) {
  const db=await store();
  const day=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles'}).format(captured);
  await db.runAsync('DELETE FROM observations WHERE captured < ?',Date.now()-windowMs);
  await db.runAsync('INSERT OR IGNORE INTO observations VALUES (?,?,?,?,?,?)',member,route,kind,Math.floor(meters/500),day,captured);
}
export async function observationCount(member:string,route:string) {
  const db=await store();
  const row=await db.getFirstAsync<{n:number}>('SELECT count(*) AS n FROM observations WHERE member=? AND route=? AND captured>=?',member,route,Date.now()-windowMs);
  return row?.n ?? 0;
}
