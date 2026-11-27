import {useMemo} from 'react';
import {Linking,Pressable,StyleSheet,View} from 'react-native';
import {Text} from '@underground/ui';
import {useIntelWeather} from '../../lib/use-intel-weather';
import {routeCameraBrief} from '../../lib/route-camera-brief';
import {snapshot} from '../../map-layers/cameras';
import {CompactIntelMarker} from '../conquest/IntelMarker';

export type SavedNotice={text:string;source:string;date:string};
type Props={
 slug:string|null;
 state?:'CA'|'FL';
 coordinates?:readonly (readonly number[])[];
 notices?:readonly SavedNotice[];
 seasonalClosure?:boolean;
 accessNote?:string;
 clearanceNote?:string;
};
const NONE:readonly SavedNotice[]=[];
function SourceLink({url,label}:{url:string;label:string}){
 return <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(url).catch(()=>{})}><Text gold style={s.link}>{label}</Text></Pressable>;
}
export function IntelRouteStatus({slug,state,coordinates,notices=NONE,seasonalClosure=false,accessNote,clearanceNote}:Props){
 const mapped=!!coordinates&&coordinates.length>=2;
 const {weather:alerts,weatherCheck,message,refresh}=useIntelWeather(mapped?slug:null);
 const cameras=useMemo(()=>routeCameraBrief(state==='CA'&&mapped?snapshot():null,coordinates,state),[coordinates,state,mapped]);
 const status=seasonalClosure?'DISRUPTED':alerts.length||notices.length?'CAUTION':'UNKNOWN';
 return <View style={s.card}>
  <Text gold variant="caption">UNDERGROUND INTEL / BEFORE YOU GO</Text>
  <Text style={[s.status,{color:status==='DISRUPTED'?'#F19C86':status==='CAUTION'?'#E8B96D':'#AAB3B8'}]}>{status}</Text>
  <Text style={s.note}>{seasonalClosure?'Seasonal access restriction. Confirm reopening with the road authority.':status==='CAUTION'?'Review the advisories before departure.':'Road readiness has not been verified.'}</Text>
  <View style={s.section}>
   <Text style={s.heading}>WEATHER</Text>
   <Text style={s.note}>{!mapped?'No verified route geometry for a route-specific weather check.':!slug?'No registered route assessment. Check the official forecast.':weatherCheck?'NWS feed checked '+new Date(weatherCheck.checked_at*1000).toLocaleString()+'. Polygon-based coverage only.':message||'Official weather check unavailable or expired.'}</Text>
   {alerts.length===0&&weatherCheck&&<Text style={s.note}>No active mapped alert polygons matched. Other weather alerts may apply.</Text>}
   {alerts.map(alert=><View key={alert.id} style={s.alert}>
    <CompactIntelMarker kind="weather"/>
    <View style={{flex:1}}><Text>{alert.title}</Text><Text style={s.note}>NWS / {alert.severity} / refresh by {new Date(alert.expires*1000).toLocaleString()}</Text></View>
   </View>)}
   <SourceLink url="https://www.weather.gov/" label="Official weather forecast"/>
  </View>
  <View style={s.section}>
   <Text style={s.heading}>ROAD ACCESS / HAZARDS</Text>
   {seasonalClosure&&<Text style={{color:'#F19C86'}}>Seasonal navigation restriction is in effect.</Text>}
   {notices.map(notice=><View key={notice.text} style={s.alert}>
    <CompactIntelMarker kind="construction"/><View style={{flex:1}}><Text>{notice.text}</Text><SourceLink url={notice.source} label={'Saved official bulletin / '+notice.date}/></View>
   </View>)}
   <Text style={s.note}>Live incident-to-road matches are still unverified. Check current closures, construction, collisions and debris with the road authority.</Text>
   {state==='CA'&&<SourceLink url="https://quickmap.dot.ca.gov/" label="Caltrans current road conditions"/>}
   {state==='FL'&&<SourceLink url="https://fl511.com/" label="Florida 511 current road conditions"/>}
   {!!accessNote&&<Text style={s.note}>{accessNote}</Text>}
   {!!clearanceNote&&<Text style={s.note}>{clearanceNote}</Text>}
  </View>
  <View style={s.section}>
   <Text style={s.heading}>FIXED CAMERA INFRASTRUCTURE</Text>
   {cameras.state==='partial'?<>
    <View style={s.alert}><CompactIntelMarker kind="speed"/><View style={{flex:1}}><Text>{cameras.speed} speed-camera listings / {cameras.redlight} signal-camera listings</Text><Text style={s.note}>Saved records near the route, not confirmed active cameras.</Text></View></View>
    <View style={s.alert}><CompactIntelMarker kind="alpr"/><View style={{flex:1}}><Text>{cameras.plate} plate-reader listings</Text><Text style={s.note}>Privacy infrastructure, not a road hazard or speed enforcement claim.</Text></View></View>
    <Text style={s.note}>California snapshot {cameras.snapshot}. Proximity only; locations can be on adjacent roads or duplicated across providers. Coverage is incomplete. Municipal reuse review pending.</Text>
   </>:<Text style={s.note}>{state==='FL'?'Florida camera coverage is not available.':'Fixed-camera coverage is unknown for this route.'}</Text>}
  </View>
  <Text style={s.note}>Absence of reports or camera records does not establish safe conditions or clearance. Obey posted signs, restrictions and official instructions.</Text>
  {mapped&&slug&&<Pressable accessibilityRole="button" onPress={refresh}><Text gold>Refresh conditions</Text></Pressable>}
 </View>;
}
const s=StyleSheet.create({card:{padding:16,borderWidth:1,borderColor:'#625543',borderRadius:10,backgroundColor:'#11191C',gap:9},status:{fontSize:25,fontFamily:'BarlowCondensed_700Bold'},note:{color:'#AAB3B8',fontSize:13,lineHeight:19},section:{borderTopWidth:1,borderColor:'#384147',paddingTop:10,gap:7},heading:{fontSize:12,letterSpacing:1.1,fontWeight:'700',color:'#E7C892'},alert:{flexDirection:'row',gap:8,alignItems:'flex-start'},link:{fontSize:12,paddingVertical:7}});
