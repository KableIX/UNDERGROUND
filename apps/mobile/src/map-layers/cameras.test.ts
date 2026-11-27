import {describe,expect,it} from 'vitest';
import {cameraPins,initialLayers,regionBox,snapshot} from './cameras';
import {drawZones,zoneLabel} from './history';
import {routeDistances,type RoutePoint} from '../drive/route-navigation';
import saratoga from '../data/saratoga-club-route.json';
const db=snapshot()!;
const square=(x:number,y:number,w:number)=>regionBox({longitude:x,latitude:y,longitudeDelta:w,latitudeDelta:w});
const enabled={plate:true,speed:true,history:false};
describe('California beta camera map',()=>{
  it('indexes real observations across northern, central, coastal, inland and southern California',()=>{
    expect(db.counts.reader).toBeGreaterThan(10000);
    const cells=Object.values(db.cells).flat();
    for(const [lon,lat] of [[-124.16,40.8],[-122.39,40.59],[-122.02,37.26],[-119.78,36.74],[-119.02,35.37],[-118.24,34.05],[-117.16,32.72],[-115.56,32.79]]){
      const sample=cells.find(r=>r[2]==='plate'&&Math.abs(r[0]-lon!)<0.075&&Math.abs(r[1]-lat!)<0.075)!;
      expect(cameraPins(db,square(sample[0],sample[1],0.012),{...initialLayers,plate:true}).some(p=>p.id===sample[3]+'/'+sample[4])).toBe(true);
    }
  });
  it('keeps camera types distinct and preserves city status when supplied',()=>{
    for(const source of ['sj','sf','oak','la','osm']){
      const p=Object.values(db.cells).flat().find(r=>r[3]===source)!;
      const visible=cameraPins(db,square(p[0],p[1],0.012),{...initialLayers,speed:true});
      expect(visible.every(pin=>pin.kind==='speed')).toBe(true);
      const selected=visible.find(pin=>pin.id===source+'/'+p[4])!;
      expect(selected.detail).toContain(p[6] || 'Operating status unknown');
    }
  });
  it('handles unavailable data and hides pins when zoomed out or both toggles are off',()=>{
    expect(cameraPins(null,square(-122,37,0.02),enabled)).toEqual([]);
    expect(cameraPins(db,square(-122,37,2),enabled)).toEqual([]);
    expect(cameraPins(db,square(-122,37,0.02),{plate:false,speed:false,history:false})).toEqual([]);
    expect(cameraPins(db,square(-80,27,0.02),enabled)).toEqual([]);
  });
  it('replays the Saratoga road book without changing route geometry or guidance distances',()=>{
    const points=saratoga.geometry.coordinates as RoutePoint[];
    const distances=routeDistances(points);
    expect(cameraPins(db,square(points[0]![0],points[0]![1],0.02),enabled).length).toBeGreaterThan(0);
    expect(Math.max(...points.filter((_,i)=>i%20===0).map(([x,y])=>cameraPins(db,square(x,y,0.01),enabled).length))).toBeGreaterThan(0);
    expect(routeDistances(points)).toEqual(distances);
  });
  it('clips a historical zone to the actual bends in the route',()=>{
    const points:RoutePoint[]=[[0,0],[0.002,0],[0.002,0.002]];
    const zone={start_m:120,end_m:900,occasions:4,last_month:'2026-11-01'};
    const line=drawZones(points,[zone])[0]!;
    expect(line.coords).toHaveLength(3);
    expect(line.coords[1]).toEqual(points[1]);expect(line.coords[2]).toEqual(points[2]);
    expect(line.coords[0]![0]).toBeCloseTo(120/111320,5);
    expect(drawZones(points,[{...zone,start_m:700}])).toEqual([]);
    expect(zoneLabel(zone)).toContain('2026-11');
  });
});
