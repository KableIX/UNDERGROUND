import { observationCount, saveObservation, type Observation } from '../../map-layers/preview-observations';
import { useSession } from '../../session/SessionContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import type { Fix } from '../../drive/route-navigation';
import { getMobileSupabaseClient } from '../../session/supabase-session';

const labels = {speed_check:'Speed check', patrol:'Patrol sighting', traffic_control:'Patrol directing traffic', crash:'Crash', hazard:'Road hazard', closure:'Closure'};
type Kind = keyof typeof labels;
type Report = {id:string; kind:Kind; meters:number; latitude:number; longitude:number; confirmed_at:string; expires_at:string; own:boolean; vote:boolean|null};
type Props = {route:string; fix:Fix|null; locationMeters:number|null; meters:number; started:boolean; now:number};
type Snapshot = {longitude:number; latitude:number; meters:number; captured:number};
function Action({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}) {
  return <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}} onPress={onPress}
    style={[s.button, disabled && s.disabled]}><Text style={s.label}>{label}</Text></Pressable>;
}
function near(fix:Fix|null,r:Report) {
  return !!fix && Math.hypot((fix.longitude-r.longitude)*111320*Math.cos(r.latitude*Math.PI/180),(fix.latitude-r.latitude)*111320)<=250;
}
export function RouteConditions({route,fix,locationMeters,meters,started,now}:Props) {
  const client=getMobileSupabaseClient();
  const {state}=useSession();
  const member=state.status==='authenticated' ? state.member.memberId : null;
  const [localCount,setLocalCount]=useState(0);
  useEffect(()=>{
    let mounted=true;
    setLocalCount(0);
    if(!client && member)void observationCount(member,route).then(n=>{if(mounted)setLocalCount(n);}).catch(()=>{});
    return ()=>{mounted=false;};
  },[client,member,route]);
  const [reports,setReports]=useState<Report[]>([]);
  const [unavailable,setUnavailable]=useState(false);
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [feedback,setFeedback]=useState('');
  const [busy,setBusy]=useState(false);
  const lock=useRef(false);
  const version=useRef(0);
  const load=useCallback(async()=>{
    if (!client) return;
    const ticket=++version.current;
    try {
      const {data,error}=await client.rpc('active_route_conditions',{slug:route});
      if(error) throw error;
      if(ticket===version.current){setReports(data ?? []);setUnavailable(false);}
    } catch {if(ticket===version.current)setUnavailable(true);}
  },[client,route]);
  useEffect(()=>{
    void load();
    const timer=setInterval(()=>void load(),20000);
    return ()=>{clearInterval(timer);version.current++;};
  },[load]);
  async function write(name:string,args:Record<string,unknown>,success:string) {
    if(!client || lock.current)return;
    lock.current=true;setBusy(true);setFeedback('');
    try {
      const {error}=await client.rpc(name,args);
      if(error)throw error;
      setSnapshot(null);setFeedback(success);await load();
    } catch(error) {
      setFeedback(error && typeof error==='object' && 'message' in error ? String(error.message) : 'Could not save. Try again.');
    } finally {lock.current=false;setBusy(false);}
  }
  function capture(){
    if(!fix || locationMeters===null || fix.accuracyM===null || fix.accuracyM>25 || Date.now()-fix.timestamp>15000){
      setFeedback('An accurate GPS fix on this route is needed to report.');return;
    }
    setFeedback('');
    setSnapshot({longitude:fix.longitude,latitude:fix.latitude,meters:Math.round(locationMeters),captured:Date.now()});
  }
  async function submit(kind:Kind){
    if(!snapshot)return;
    if(Date.now()-snapshot.captured>60000){setSnapshot(null);setFeedback('Tap Report again for a fresh location.');return;}
    if(!client){
      if(!member || lock.current || (kind!=='speed_check' && kind!=='patrol' && kind!=='traffic_control'))return;
      lock.current=true; setBusy(true);
      try {
        await saveObservation(member,route,kind,snapshot.meters,snapshot.captured);
        setSnapshot(null);setFeedback('Saved on this iPhone.');
        setLocalCount(await observationCount(member,route));
      } catch {setFeedback('Could not save on this iPhone. Try again.');}
      finally {lock.current=false;setBusy(false);}
      return;
    }
    void write('report_route_condition',{slug:route,category:kind,at_meters:snapshot.meters,lon:snapshot.longitude,lat:snapshot.latitude},'Route report saved.');
  }
  if(!client && !member)return <Text style={s.note}>Sign in to record road observations.</Text>;
  const availableKinds:Kind[]=client ? Object.keys(labels) as Kind[] : ['speed_check','patrol','traffic_control'] satisfies Observation[];
  const live=reports.filter(r=>Date.parse(r.expires_at)>now && (!started || r.meters>=meters-250 || near(fix,r)));
  return <View style={s.panel}>
    {!client && <Text style={s.note}>Private observations on this iPhone · {localCount} on this route. Club sharing is offline.</Text>}
    {unavailable && <Text style={s.note}>Live report updates unavailable.</Text>}
    {live.map(r=>{
      const age=Math.max(0,Math.floor((now-Date.parse(r.confirmed_at))/60000));
      return <View key={r.id}>
        <Text style={s.head}>{labels[r.kind]} · {(r.meters/1609.344).toFixed(1)} mi from start</Text>
        <Text style={s.note}>Last seen {age ? age+' min ago' : 'just now'}</Text>
        {!r.own && locationMeters!==null && near(fix,r) && <View style={s.row}><Text style={s.note}>Still there?</Text>
          {([true,false] as const).map(p=><Action key={String(p)} label={(p?'Yes':'No')+(r.vote===p?' ✓':'')} disabled={busy || r.vote===p}
            onPress={()=>{if(fix)void write('verify_route_condition',{target:r.id,still_present:p,lon:fix.longitude,lat:fix.latitude},'Verification saved.');}}/>)}
        </View>}
      </View>;
    })}
    {snapshot ? <View style={s.row}>{availableKinds.map(k=><Action key={k} label={labels[k]} onPress={()=>submit(k)} disabled={busy}/>)}
      <Action label="Cancel" disabled={busy} onPress={()=>setSnapshot(null)}/></View>
      : <Action label="Report road condition" onPress={capture} disabled={busy}/>}
    {!!feedback && <Text accessibilityLiveRegion="polite" style={s.note}>{feedback}</Text>}
  </View>;
}
const s=StyleSheet.create({
  panel:{gap:6},row:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},
  button:{alignSelf:'flex-start',justifyContent:'center',minHeight:44,paddingHorizontal:10,backgroundColor:'#22272B',borderRadius:7},
  disabled:{opacity:0.55},label:{color:'#FFFFFF',fontSize:13},note:{color:'#BEC4C9',fontSize:12},head:{color:'#FFBB74',fontSize:14},
});
