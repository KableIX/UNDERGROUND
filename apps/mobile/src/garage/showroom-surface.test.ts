import { describe, expect, it } from 'vitest';
import { decode } from 'base64-arraybuffer';
import r8 from '../../assets/garage/r8-surface.json';
import sto from '../../assets/garage/sto-surface.json';
import occlusion from '../../assets/garage/garage-occlusion.json';
import texture from '../../assets/garage/sto-uv.json';
import { renderGarage, homeCamera } from './render';
import { defaultBuilds } from './builds';

describe('showroom surface assets', () => {
  for (const [car, data] of Object.entries({r8,sto})) {
    it('aligns the ' + car + ' material, visibility, and triangle buffers', () => {
      const vertices = decode(data.position).byteLength / 6;
      expect(decode(data.material).byteLength).toBe(vertices);
      expect(decode(data.normal).byteLength).toBe(vertices*3);
      expect(decode(occlusion[car as keyof typeof occlusion]).byteLength).toBe(vertices);
      const bytes=decode(data.index);
      const indices=car==='sto'&&texture.index32 ? new Uint32Array(bytes) : new Uint16Array(bytes);
      let high=0;
      for (const index of indices) high=Math.max(high,index);
      expect(high).toBeLessThan(vertices);
      if(car==='sto'){
        expect(high).toBeGreaterThan(65535);
        expect(decode(texture.coord).byteLength).toBe(vertices*4);
        expect(decode(texture.layer).byteLength).toBe(vertices);
      }
    });
  }
  it('renders the selected finish into the truecolor frame for both vehicles', () => {
    for(const car of ['r8','sto'] as const){
      const frame=renderGarage(128,128,homeCamera,false,car);
      const altered=renderGarage(128,128,homeCamera,false,car,{...defaultBuilds.builds[car],paint:'red'});
      expect(altered).not.toBe(frame);
      const png=new Uint8Array(decode(frame.slice(frame.indexOf(',')+1)));
      expect(png[25]).toBe(2); // RGB PNG, no indexed material palette.
    }
  });
});
