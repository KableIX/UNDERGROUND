import {describe,it,expect} from 'vitest';
import {parseIntelAssessment,currentWeather,seriousWeather} from './intel-weather';
const alert={id:'nws:test',title:'Flash Flood Warning',source:'nws-CA',expires:2000,severity:'Severe',segments:[[[-122,37],[-122.1,37.1]]]};
describe('official weather preview',()=>{
 it('rejects stale, future, wrong-route and malformed results',()=>{
  expect(parseIntelAssessment({route:'a',generated_at:100,weather:[]},'a',700)).toBeNull();
  expect(parseIntelAssessment({route:'a',generated_at:101,weather:[]},'a',100)).toBeNull();
  expect(parseIntelAssessment({route:'b',generated_at:100,weather:[]},'a',100)).toBeNull();
  expect(parseIntelAssessment({},'a',100)).toBeNull();
 });
 it('filters unapproved sources and duplicate or expired alerts, bounds freshness',()=>{
  const r=parseIntelAssessment({route:'a',generated_at:100,weather:[alert,alert,{...alert,id:'other',source:'member'},{...alert,id:'old',expires:100}]},'a',100)!;
  expect(r.weather.length).toBe(1);
  expect(r.weather[0]!.expires).toBe(700);
  expect(currentWeather(r,700)).toEqual([]);
 });
 it('keeps only valid display segments and chooses serious road-weather alerts',()=>{
  const r=parseIntelAssessment({route:'a',generated_at:100,weather:[{...alert,segments:[alert.segments[0],[[0,91],[0,92]]]}]},'a',100)!;
  expect(r.weather[0]!.segments).toEqual(alert.segments);
  expect(seriousWeather(r.weather)?.title).toBe(alert.title);
  expect(seriousWeather([{...r.weather[0]!,severity:'Minor'}])).toBeUndefined();
 });
});
