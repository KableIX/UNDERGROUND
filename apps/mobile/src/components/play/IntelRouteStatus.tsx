import {Pressable,StyleSheet,View} from 'react-native';
import {Text} from '@underground/ui';

import {useIntelWeather} from '../../lib/use-intel-weather';
import {CompactIntelMarker} from '../conquest/IntelMarker';
export function IntelRouteStatus({slug}:{slug:string}){
 const {weather:alerts,fresh,message,refresh}=useIntelWeather(slug);
 return <View style={s.card}>
  <Text gold variant="caption">UNDERGROUND INTEL / ROUTE STATUS</Text>
  <Text style={[s.status,{color:alerts.length?'#E8B96D':'#AAB3B8'}]}>{alerts.length?'CAUTION':'UNKNOWN'}</Text>
  <Text style={s.note}>{message || (fresh?'Partial coverage. Road conditions not yet assessed.':'Official information is stale or unavailable.')}</Text>
  {alerts.map(alert=><View key={alert.id} style={[s.alert,{flexDirection:'row',gap:8}]}>
    <CompactIntelMarker kind="weather"/>
    <View style={{flex:1}}><Text>{alert.title}</Text>
    <Text style={s.note}>National Weather Service / {alert.severity} / refresh by {new Date(alert.expires*1000).toLocaleString()}</Text></View>
  </View>)}
  <Text style={s.note}>Absence of reports does not mean the road is clear. Obey official instructions and posted signs.</Text>
  <Pressable accessibilityRole="button" onPress={refresh}><Text gold>Refresh conditions</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({card:{padding:16,borderWidth:1,borderColor:'#625543',borderRadius:10,backgroundColor:'#11191C',gap:9},status:{fontSize:25,fontFamily:'BarlowCondensed_700Bold'},note:{color:'#AAB3B8',fontSize:13,lineHeight:19},alert:{borderTopWidth:1,borderColor:'#384147',paddingTop:9,gap:4}});
