import { describe, it, expect, vi, afterEach } from 'vitest';
import { alprBounds, parseAlprData, fetchAlpr } from './alpr';
describe('reported plate readers', () => {
 afterEach(() => vi.unstubAllGlobals());
 it('rounds the requested area instead of sending exact GPS', () => {
  const box = alprBounds(37.333123, -121.893456);
  expect(box).toEqual([37.25, -122, 37.45, -121.80000000000001]);
  expect(() => alprBounds(91, 0)).toThrow();
 });
 it('accepts only mapped ALPRs and preserves unknown manufacturer', () => {
  const result=parseAlprData({elements:[
   {type:'node',id:10,lat:37,lon:-122,tags:{'surveillance:type':'ALPR',brand:'Flock Safety'}},
   {type:'way',id:11,center:{lat:38,lon:-121},tags:{'surveillance:type':'ALPR'}},
   {type:'node',id:12,lat:37,lon:-122,tags:{'surveillance:type':'camera'}},
   {type:'node',id:13,lat:999,lon:0,tags:{'surveillance:type':'ALPR'}}
  ]});
  expect(result).toHaveLength(2);expect(result[0].manufacturer).toBe('Flock Safety');expect(result[1].manufacturer).toBeNull();
  expect(() => parseAlprData({})).toThrow();
 });
 it('surfaces errors instead of reporting an empty area', async () => {
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:429}));
  await expect(fetchAlpr(37,-122)).rejects.toThrow('429');
 });
});
