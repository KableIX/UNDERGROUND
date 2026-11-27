import {useEffect,useState} from 'react';
import {Pressable,StyleSheet,View} from 'react-native';
import {Text} from '@underground/ui';

type AlertItem={title:string;source:string;expires:number};
type Assessment={route:string;status:'CAUTION'|'UNKNOWN';generated_at:number;weather:AlertItem[];road_status:string};
const BASE=process.env.EXPO_PUBLIC_INTEL_URL || (__DEV__?'https://atlas.tail32f2e6.ts.net:8444':'');
export function IntelRouteStatus({slug}:{slug:string}){
 const [data,setData]=useState<Assessment|null>(null);
 const [message,setMessage]=useState('Checking official advisories...');
 const [revision,setRevision]=useState(0);
 useEffect(()=>{
  let active=true; let controller:AbortController|undefined;
  async function load(){
   controller?.abort();controller=new AbortController();
   if(!BASE){setMessage('INTEL preview is not configured.');return;}
   const signal=controller.signal;
   const timeout=setTimeout(()=>controller?.abort(),10000);
   try{
    const response=await fetch(BASE+'/v1/routes/'+encodeURIComponent(slug),{signal});
    if(!response.ok)throw Error('unavailable');
    const value=await response.json() as Assessment;
    if(value.route!==slug || !Array.isArray(value.weather) || !Number.isFinite(value.generated_at) || !['CAUTION','UNKNOWN'].includes(value.status))throw Error('invalid response');
    if(active && !signal.aborted){setData(value);setMessage('');}
   }catch{if(active && !signal.aborted){setData(null);setMessage('Official advisories unavailable.');}else if(active){setData(null);setMessage('INTEL connection timed out.');}}
   finally{clearTimeout(timeout);}
  }
  setData(null);void load();const interval=setInterval(()=>void load(),60000);
  return()=>{active=false;clearInterval(interval);controller?.abort();};
 },[slug,revision]);
 const fresh=data && Date.now()/1000-data.generated_at>=0 && Date.now()/1000-data.generated_at<=600;
 const alerts=fresh?data.weather.filter(a=>a.expires>Date.now()/1000 && typeof a.title==='string' && typeof a.source==='string'):[];
 return <View style={s.card}>
  <Text gold variant="caption">UNDERGROUND INTEL / ROUTE STATUS</Text>
  <Text style={[s.status,{color:alerts.length?'#E8B96D':'#AAB3B8'}]}>{alerts.length?'CAUTION':'UNKNOWN'}</Text>
  <Text style={s.note}>{message || (fresh?'Partial coverage. Road conditions not yet assessed.':'Official information is stale or unavailable.')}</Text>
  {alerts.map((alert,i)=><View key={alert.source+':'+i} style={s.alert}>
    <Text>{alert.title}</Text>
    <Text style={s.note}>National Weather Service / expires {new Date(alert.expires*1000).toLocaleString()}</Text>
  </View>)}
  <Text style={s.note}>Absence of reports does not mean the road is clear. Obey official instructions and posted signs.</Text>
  <Pressable accessibilityRole="button" onPress={()=>setRevision(n=>n+1)}><Text gold>Refresh conditions</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({card:{padding:16,borderWidth:1,borderColor:'#625543',borderRadius:10,backgroundColor:'#11191C',gap:9},status:{fontSize:25,fontFamily:'BarlowCondensed_700Bold'},note:{color:'#AAB3B8',fontSize:13,lineHeight:19},alert:{borderTopWidth:1,borderColor:'#384147',paddingTop:9,gap:4}});
