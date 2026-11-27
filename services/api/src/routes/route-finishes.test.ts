import {describe,expect,it} from 'vitest';
import {validateFinish} from './route-finishes';
import {type RunFix} from '../../../../apps/mobile/src/drive/finish-proof';
import roads from '../../../../apps/mobile/src/data/california-road-routes.json';
import catalog from '../../../../apps/mobile/src/data/california-catalog.json';
import {routeDistances, type RoutePoint} from '../../../../apps/mobile/src/drive/route-navigation';
const slug = catalog.find(row=>row.id==='M01')!.slug;
const points = roads.M01.coordinates as RoutePoint[];
const distances = routeDistances(points);
const trace: RunFix[] = points.map(([x,y],i)=>[x,y,4,1000 + i + Math.ceil(distances[i]! * 100)]);
describe('finish submissions',()=>{
  it('computes a time from the route and rejects incomplete attempts',()=>{
    const run={kind:'RUN',route:slug,attempt:'one',trace};
    const result=validateFinish(run);
    expect(result && 'duration' in result && result.duration).toBeGreaterThan(0);
    expect(validateFinish({...run,trace:trace.slice(0,3)})).toBeNull();
    expect(validateFinish({...run,trace:[trace[0],trace.at(-1)]})).toBeNull();
    expect(validateFinish({...run,duration:1})).toBeNull();
  });
  it('accepts completion only for catalog Cruises and excludes test loops',()=>{
    const route=catalog.find(r=>r.id==='CR01')!.slug;
    expect(validateFinish({kind:'CRUISE',route})).toEqual({route});
    expect(validateFinish({kind:'CRUISE',route,trace})).toBeNull();
    expect(validateFinish({kind:'CRUISE',route:slug})).toBeNull();
    expect(validateFinish({kind:'RUN',route:'nvidia-campus-loop',attempt:'t',trace})).toBeNull();
  });
});
