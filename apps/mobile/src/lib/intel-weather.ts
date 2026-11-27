export type IntelWeather={id:string;title:string;source:'nws-CA'|'nws-FL';expires:number;severity:string;segments:[number,number][][]};
export type WeatherCheck={state:'fresh';checked_at:number;expires:number};
export type IntelAssessment={route:string;generated_at:number;weather:IntelWeather[];weatherCheck:WeatherCheck|null};
export type IntelCatalog=ReadonlyMap<string,IntelAssessment>;
function parseWeatherCheck(value:unknown,generated:number,now:number):WeatherCheck|null{
 if(!value||typeof value!=='object')return null;
 const x=value as Record<string,unknown>;
 if(x.state!=='fresh'||typeof x.checked_at!=='number'||!Number.isFinite(x.checked_at)||x.checked_at>now||
  typeof x.expires!=='number'||!Number.isFinite(x.expires))return null;
 const expires=Math.min(x.expires,x.checked_at+900,generated+600);
 return expires>now?{state:'fresh',checked_at:x.checked_at,expires}:null;
}
const sourceOk=(v:unknown):v is IntelWeather['source']=>v==='nws-CA'||v==='nws-FL';
function coordinates(value:unknown):[number,number][][]{
 if(!Array.isArray(value))return [];
 return value.slice(0,8).filter((line):line is [number,number][]=>Array.isArray(line)&&line.length>=2&&line.length<=1200&&line.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
}
export function parseIntelAssessment(value:unknown,slug:string,now:number):IntelAssessment|null{
 if(!value||typeof value!=='object')return null;
 const x=value as Record<string,unknown>;
 if(x.route!==slug||typeof x.generated_at!=='number'||!Number.isFinite(x.generated_at)||now<x.generated_at||now-x.generated_at>=600||!Array.isArray(x.weather))return null;
 const check=parseWeatherCheck(x.weather_check,x.generated_at,now);
 const weather:IntelWeather[]=[];
 for(const row of (x.weather_check!==undefined&&!check?[]:x.weather).slice(0,32)){
  if(!row||typeof row!=='object'||!sourceOk(row.source)||typeof row.title!=='string'||!row.title.trim()||typeof row.expires!=='number'||!Number.isFinite(row.expires)||row.expires<=now)continue;
  const id=typeof row.id==='string'?row.id:row.source+':'+row.title;
  if(weather.some(a=>a.id===id))continue;
  weather.push({id,title:row.title.slice(0,140),source:row.source,expires:Math.min(row.expires,x.generated_at+600,check?.expires??Infinity),severity:typeof row.severity==='string'?row.severity:'Unknown',segments:coordinates(row.segments)});
 }
 return {route:slug,generated_at:x.generated_at,weather,weatherCheck:check};
}
export function currentWeather(data:IntelAssessment|null,now:number):IntelWeather[]{
 if(!data||now<data.generated_at||now-data.generated_at>=600)return [];
 return data.weather.filter(a=>a.expires>now);
}
export function seriousWeather(alerts:IntelWeather[]):IntelWeather|undefined{
 return alerts.find(a=>['Severe','Extreme'].includes(a.severity)&&/flood|fire weather|tornado|thunderstorm|hurricane|tropical storm|high wind|blizzard|winter storm|ice storm|dust storm/i.test(a.title));
}

export function currentWeatherCheck(data:IntelAssessment|null,now:number):WeatherCheck|null{
 if(!data||now<data.generated_at||now-data.generated_at>=600)return null;
 return data.weatherCheck&&data.weatherCheck.expires>now?data.weatherCheck:null;
}
export function parseIntelCatalog(value:unknown,now:number):IntelCatalog|null{
 if(!value||typeof value!=='object')return null;
 const x=value as Record<string,unknown>;
 if(typeof x.generated_at!=='number'||!Number.isFinite(x.generated_at)||now<x.generated_at||now-x.generated_at>=600||
    !x.routes||typeof x.routes!=='object'||Array.isArray(x.routes))return null;
 const out=new Map<string,IntelAssessment>();
 for(const [slug,row] of Object.entries(x.routes).slice(0,256)){
  if(!/^[a-z0-9-]{1,100}$/.test(slug)||!row||typeof row!=='object')continue;
  const a=parseIntelAssessment({...row,route:slug,generated_at:x.generated_at},slug,now);
  if(a)out.set(slug,a);
 }
 return out;
}
