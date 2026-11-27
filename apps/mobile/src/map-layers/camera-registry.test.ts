import {describe,it,expect} from 'vitest';
import {cameraMarkerKind,cameraSources,cameraStatus} from './camera-registry';
import {cameraPins,initialLayers,snapshot} from './cameras';

describe('camera marker provenance',()=>{
 it('labels Flock only when the source explicitly identifies the brand',()=>{
  expect(cameraMarkerKind('plate','Flock Safety')).toBe('flock');
  expect(cameraMarkerKind('plate','FlockHopper')).toBe('alpr');
  expect(cameraMarkerKind('plate','')).toBe('alpr');
  expect(cameraMarkerKind('plate','Motorola Solutions')).toBe('alpr');
  expect(cameraMarkerKind('speed','Red Light Camera')).toBe('redlight');
  expect(cameraMarkerKind('speed','')).toBe('speed');
 });
 it('never assumes a listing is operational',()=>{
  expect(cameraStatus('')).toBe('Operating status unknown');
  expect(cameraStatus('Under Construction')).toBe('Under Construction');
 });
 it('has explicit metadata for every existing source and returns it per pin',()=>{
  const db=snapshot()!;
  for(const source of Object.keys(db.counts) as (keyof typeof cameraSources)[]){
   const row=Object.values(db.cells).flat().find(r=>r[3]===source)!;
   const pin=cameraPins(db,{west:row[0]-.001,east:row[0]+.001,south:row[1]-.001,north:row[1]+.001},initialLayers).find(p=>p.id===source+'/'+row[4])!;
   expect(pin.sourceUrl).toBe(cameraSources[source].url);
   expect(pin.license).toBe(cameraSources[source].license);
   expect(pin.lastChecked).toBe(db.retrieved);
  }
 });
});
