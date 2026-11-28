import {describe,it,expect} from 'vitest';
import {parseIntelAssessment,currentWeather,currentWeatherCheck,parseIntelCatalog,seriousWeather} from './intel-weather';
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

describe('catalog weather checks',()=>{
 const check={state:'fresh',checked_at:80,expires:150};
 it('never treats a successful assessment as evidence of fresh source coverage',()=>{
  const a=parseIntelAssessment({route:'a',generated_at:100,weather:[]},'a',100)!;
  expect(currentWeatherCheck(a,100)).toBeNull();
  const b=parseIntelAssessment({route:'a',generated_at:100,weather:[alert],weather_check:{state:'unknown'}},'a',100)!;
  expect(b.weather).toEqual([]);
  expect(currentWeatherCheck(b,100)).toBeNull();
 });
 it('expires both source coverage and advisories at the source deadline',()=>{
  const a=parseIntelAssessment({route:'a',generated_at:100,weather:[alert],weather_check:check},'a',100)!;
  expect(currentWeatherCheck(a,100)?.checked_at).toBe(80);
  expect(a.weather[0]?.expires).toBe(150);
  expect(currentWeatherCheck(a,150)).toBeNull();
  expect(currentWeather(a,150)).toEqual([]);
 });
 it('parses one compact catalog response and rejects stale or malformed entries',()=>{
  const response={generated_at:100,routes:{a:{weather:[alert],weather_check:check},b:{weather:[],weather_check:{state:'unknown'}},bad:{weather:null}}};
  const catalog=parseIntelCatalog(response,100)!;
  expect(catalog.size).toBe(2);
  expect(currentWeather(catalog.get('a')!,100)).toHaveLength(1);
  expect(currentWeatherCheck(catalog.get('b')!,100)).toBeNull();
  expect(parseIntelCatalog(response,700)).toBeNull();
  expect(parseIntelCatalog({generated_at:100,routes:[]},100)).toBeNull();
 });
});
