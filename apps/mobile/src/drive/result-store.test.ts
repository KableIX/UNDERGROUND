import {beforeEach, describe, expect, it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';

const database = new DatabaseSync(':memory:');
import {recordLocalResult, localTopThree, resultSchema, mergePersonalTimes, type ResultDatabase} from './result-sql';
const db: ResultDatabase = {
  runAsync: async (sql:string,...args:(string|number|null)[]) => database.prepare(sql).run(...args),
  getAllAsync: async <T>(sql:string,...args:(string|number|null)[]) => database.prepare(sql).all(...args) as T[],
};

describe('completed route records', () => {
  beforeEach(() => { database.exec(resultSchema); database.exec('DELETE FROM personal_bests; DELETE FROM finishes; DELETE FROM cruises;'); });
  it('keeps route and personal standings independent and retries idempotent', async () => {
    const add = (member:string,route:string,attempt:string,duration:number) => recordLocalResult(db, {memberId:member,displayName:member}, {kind:'RUN',route,attempt,duration,trace:[]}, false);
    await add('a','one','a1',4000); await add('a','one','a2',2000); await add('a','one','a3',3000);
    await add('a','one','a4',1500); await add('b','one','b1',1000); await add('b','one','b1',500);
    await add('b','one','b2',1500); await add('a','two','a5',999);
    expect((await localTopThree(db,'a','one')).map(r=>[r.name,r.millis])).toEqual([['b',1000],['a',1500],['b',1500]]);
    expect(database.prepare("SELECT count(*) AS n FROM personal_bests WHERE member='a' AND route='one'").get()?.n).toBe(3);
    const local = await localTopThree(db,'a');
    const synced = [...local,{...local[0]!,attempt:'other-device',millis:800}];
    expect(mergePersonalTimes(synced,local).filter(r=>r.route==='one').map(r=>r.millis)).toEqual([800,1500,2000]);
    expect((await localTopThree(db,'a')).map(r=>[r.route,r.millis])).toEqual([['one',1500],['one',2000],['one',3000],['two',999]]);
  });
  it('stores one untimed completion per cruiser and route', async () => {
    const done = {kind:'CRUISE' as const,route:'coast'};
    await recordLocalResult(db,{memberId:'a',displayName:'A'},done,true);
    await recordLocalResult(db,{memberId:'a',displayName:'A'},done,true);
    expect(database.prepare('SELECT * FROM cruises').all()).toEqual([{member:'a',route:'coast',pending:1}]);
    expect(await localTopThree(db,'a','coast')).toEqual([]);
  });
});
