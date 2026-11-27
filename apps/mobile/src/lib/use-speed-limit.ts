import {useEffect,useRef,useState} from 'react';
import {publicEnv} from './env';
import type {MapPosition} from './use-map-location';

type Point = {longitude:number;latitude:number;accuracyM:number|null;timestamp:number};
type Limit = {mph:number; point:Point; at:number};
function distance(a:Point,b:Point) {
  return Math.hypot((a.longitude-b.longitude)*111320*Math.cos(a.latitude*Math.PI/180),(a.latitude-b.latitude)*111320);
}
export function parseLimit(value: {speed?:number;unit?:string;unknown?:boolean;none?:boolean}|undefined):number|null {
  if(!value || value.unknown || value.none || typeof value.speed!=='number' || !Number.isFinite(value.speed) || value.speed<=0)return null;
  if(value.unit==='mph')return value.speed;
  if(value.unit==='km/h')return value.speed/1.609344;
  return null;
}
export function useSpeedLimit(position:MapPosition|null,enabled:boolean) {
  const [limit,setLimit]=useState<Limit|null>(null);
  const trace=useRef<Point[]>([]);
  const lastRequest=useRef(0);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{
    if(!enabled){request.current?.abort();request.current=null;trace.current=[];setLimit(null);return;}
    if(!position || position.accuracyM===null || position.accuracyM<0 || position.accuracyM>20 || Date.now()-position.timestamp>10000)return;
    const last=trace.current[trace.current.length-1];
    if(last && position.timestamp<=last.timestamp)return;
    if(last && (position.timestamp-last.timestamp>30000 || distance(position,last)>300))trace.current=[];
    if(!last || distance(position,last)>=8)trace.current=[...trace.current,position].slice(-6);
    if(trace.current.length<3 || Date.now()-lastRequest.current<15000 || request.current)return;
    const token=publicEnv.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if(!token)return;
    const samples=[...trace.current];
    const end=samples[samples.length-1];
    if(Date.now()-end.timestamp>10000)return;
    lastRequest.current=Date.now();
    const controller=new AbortController();
    request.current=controller;
    const timeout=setTimeout(()=>controller.abort(),8000);
    const coords=samples.map(p=>p.longitude.toFixed(6)+','+p.latitude.toFixed(6)).join(';');
    const radiuses=samples.map(p=>Math.min(20,Math.max(5,p.accuracyM??20))).join(';');
    const url='https://api.mapbox.com/matching/v5/mapbox/driving/'+coords+'?overview=full&geometries=geojson&annotations=maxspeed&radiuses='+radiuses+'&access_token='+encodeURIComponent(token);
    void fetch(url,{signal:controller.signal}).then(async r=>{
      if(!r.ok)throw Error('limit unavailable');
      const data=await r.json();
      const matching=data.matchings?.[0];
      const final=data.tracepoints?.[samples.length-1];
      const leg=matching?.legs?.[matching.legs.length-1];
      const values=leg?.annotation?.maxspeed;
      if(controller.signal.aborted)return;
      if(data.code!=='Ok'||data.matchings?.length!==1||matching?.confidence<0.9||!Number.isFinite(matching?.confidence)||!final||final.matchings_index!==0||!Array.isArray(final.location)||distance(end,{...end,longitude:final.location[0],latitude:final.location[1]})>20||!Array.isArray(values)||!values.length){setLimit(null);return;}
      const mph=parseLimit(values[values.length-1]);
      setLimit(mph===null?null:{mph,point:end,at:Date.now()});
    }).catch(()=>{if(!controller.signal.aborted)setLimit(null);}).finally(()=>{clearTimeout(timeout);if(request.current===controller)request.current=null;});
  },[position,enabled]);
  if(!enabled||!position||!limit||position.accuracyM===null||position.accuracyM>20||position.accuracyM<0||Date.now()-position.timestamp>10000||Date.now()-limit.at>20000||distance(position,limit.point)>40)return null;
  return limit.mph;
}
