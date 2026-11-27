export type IntelWeather={id:string;title:string;source:'nws-CA'|'nws-FL';expires:number;severity:string;segments:[number,number][][]};
export type IntelAssessment={route:string;generated_at:number;weather:IntelWeather[]};
const sourceOk=(v:unknown):v is IntelWeather['source']=>v==='nws-CA'||v==='nws-FL';
function coordinates(value:unknown):[number,number][][]{
 if(!Array.isArray(value))return [];
 return value.slice(0,8).filter((line):line is [number,number][]=>Array.isArray(line)&&line.length>=2&&line.length<=1200&&line.every(p=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90));
}
export function parseIntelAssessment(value:unknown,slug:string,now:number):IntelAssessment|null{
 if(!value||typeof value!=='object')return null;
 const x=value as Record<string,unknown>;
 if(x.route!==slug||typeof x.generated_at!=='number'||!Number.isFinite(x.generated_at)||now<x.generated_at||now-x.generated_at>=600||!Array.isArray(x.weather))return null;
 const weather:IntelWeather[]=[];
 for(const row of x.weather.slice(0,32)){
  if(!row||typeof row!=='object'||!sourceOk(row.source)||typeof row.title!=='string'||!row.title.trim()||typeof row.expires!=='number'||!Number.isFinite(row.expires)||row.expires<=now)continue;
  const id=typeof row.id==='string'?row.id:row.source+':'+row.title;
  if(weather.some(a=>a.id===id))continue;
  weather.push({id,title:row.title.slice(0,140),source:row.source,expires:Math.min(row.expires,x.generated_at+600),severity:typeof row.severity==='string'?row.severity:'Unknown',segments:coordinates(row.segments)});
 }
 return {route:slug,generated_at:x.generated_at,weather};
}
export function currentWeather(data:IntelAssessment|null,now:number):IntelWeather[]{
 if(!data||now<data.generated_at||now-data.generated_at>=600)return [];
 return data.weather.filter(a=>a.expires>now);
}
export function seriousWeather(alerts:IntelWeather[]):IntelWeather|undefined{
 return alerts.find(a=>['Severe','Extreme'].includes(a.severity)&&/flood|fire weather|tornado|thunderstorm|hurricane|tropical storm|high wind|blizzard|winter storm|ice storm|dust storm/i.test(a.title));
}
