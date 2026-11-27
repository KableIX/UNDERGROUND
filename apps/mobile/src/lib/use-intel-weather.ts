import {useEffect,useState} from 'react';
import {AppState} from 'react-native';
import {currentWeather,parseIntelAssessment,type IntelAssessment} from './intel-weather';
const BASE=process.env.EXPO_PUBLIC_INTEL_URL || (__DEV__?'https://atlas.tail32f2e6.ts.net:8444':'');
export function useIntelWeather(slug:string|null|undefined){
 const [data,setData]=useState<IntelAssessment|null>(null);
 const [message,setMessage]=useState('Checking official advisories...');
 const [revision,setRevision]=useState(0);
 const [clock,setClock]=useState(()=>Date.now()/1000);
 useEffect(()=>{
  let live=true;let request:AbortController|null=null;
  setData(null);
  if(!slug||!BASE){setMessage('INTEL preview is not configured.');return;}
  const load=async()=>{
   if(request||!live||(AppState.currentState!=null&&AppState.currentState!=='active'))return;
   const controller=new AbortController();request=controller;
   const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const r=await fetch(BASE.replace(/\/$/,'')+'/v1/routes/'+encodeURIComponent(slug),{signal:controller.signal});
    if(!r.ok)throw Error('unavailable');
    const now=Date.now()/1000;
    const result=parseIntelAssessment(await r.json(),slug,now);
    if(!result)throw Error('invalid response');
    if(live&&!controller.signal.aborted){setData(result);setMessage('');setClock(now);}
   }catch{if(live){setData(null);setMessage('Official advisories unavailable.');}}
   finally{clearTimeout(timeout);if(request===controller)request=null;}
  };
  setMessage('Checking official advisories...');
  void load();
  const poll=setInterval(()=>void load(),60000);
  const expiry=setInterval(()=>setClock(Date.now()/1000),5000);
  const sub=AppState.addEventListener('change',state=>{if(state==='active'){setClock(Date.now()/1000);void load();}});
  return()=>{live=false;clearInterval(poll);clearInterval(expiry);sub.remove();request?.abort();};
 },[slug,revision]);
 const valid=data?.route===slug?data:null;
 return {weather:currentWeather(valid,clock),fresh:!!valid&&clock>=valid.generated_at&&clock-valid.generated_at<600,message,refresh:()=>setRevision(n=>n+1)};
}
