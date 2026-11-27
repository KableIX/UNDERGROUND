import {describe,expect,it} from 'vitest';
import {cameraPins,cameraDisplayPins,cameraViewportMode,cameraViewportNote,initialLayers,regionBox,snapshot} from './cameras';
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
      const visible=cameraPins(db,square(p[0],p[1],0.012),{plate:false,speed:true,history:false});
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
  it('shows records in a city-scale view instead of the old street-only cutoff',()=>{
    const b=square(-121.9677,37.3706,.15);
    expect(cameraViewportMode(b)).toBe('city');
    expect(cameraPins(db,b,enabled).length).toBeGreaterThan(100);
    expect(cameraViewportMode(square(-121.9677,37.3706,.02))).toBe('street');
    expect(cameraViewportMode(square(-121.9677,37.3706,2))).toBe('zoom');
  });
  it('bounds dense city rendering without inventing locations',()=>{
    const b=square(-121.9677,37.3706,.35);
    const all=cameraPins(db,b,enabled), shown=cameraDisplayPins(all,b);
    expect(all.length).toBeGreaterThan(288);
    expect(shown.length).toBeLessThanOrEqual(288);
    expect(shown.every(p=>all.some(a=>a.id===p.id&&a.lon===p.lon&&a.lat===p.lat))).toBe(true);
    expect(cameraViewportNote('city',all.length,shown.length,true)).toContain('zoom for more');
    expect(cameraViewportNote('city',0,0,true)).toContain('No camera records');
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
