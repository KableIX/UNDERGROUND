import {useEffect,useRef,useState} from 'react';
import {AccessibilityInfo,Animated,Easing,Modal,Pressable,StyleSheet,Text,View,Linking} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type {CameraPin} from '../../map-layers/cameras';
import type {CameraMarkerKind} from '../../map-layers/camera-registry';

export type IntelMarkerKind=CameraMarkerKind|'radar'|'advisory'|'closure'|'accident'|'hazard'|'weather'|'construction';
const designs={
 flock:{color:'#8DDBFF',glyph:'camera',label:'FLOCK'},
 alpr:{color:'#8DDBFF',glyph:'camera',label:'ALPR'},
 speed:{color:'#FFBF56',glyph:'camera',label:'SPEED'},
 redlight:{color:'#FFBF56',glyph:'traffic-light',label:'SIGNAL'},
 radar:{color:'#FFBF56',glyph:'radar',label:'RADAR'},
 advisory:{color:'#9CC5FF',glyph:'star',label:'ADVISORY'},
 closure:{color:'#FF6262',glyph:'road-variant',label:'CLOSURE'},
 accident:{color:'#FF9C4D',glyph:'car',label:'ACCIDENT'},
 hazard:{color:'#FFD35C',glyph:'alert',label:'HAZARD'},
 weather:{color:'#BEA2FF',glyph:'weather-lightning',label:'WEATHER'},
 construction:{color:'#DBA36A',glyph:'traffic-cone',label:'ROADWORK'},
} as const;

export function useReducedMotion(){
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{
  let live=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(v=>{if(live)setReduced(v);}).catch(()=>{});
  const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);
  return()=>{live=false;sub.remove();};
 },[]);
 return reduced;
}
// Compact pins are static: expensive animation only in a selected detail view.
export function CompactIntelMarker({kind}:{kind:IntelMarkerKind}){
 const d=designs[kind];
 return <View pointerEvents="none" style={s.compact}>
  <MaterialCommunityIcons name="shield" size={28} color="#12191F" style={s.compactShield}/>
  <MaterialCommunityIcons name="shield-outline" size={28} color={d.color} style={s.compactShield}/>
  <MaterialCommunityIcons name={d.glyph} size={12} color={d.color} style={{position:'absolute',top:7,left:10}}/>
  <Text style={[s.miniLabel,{color:d.color}]}>{d.label}</Text>
 </View>;
}

export function IntelMarker({kind,animated=true}:{kind:IntelMarkerKind;animated?:boolean}){
 const d=designs[kind], reduced=useReducedMotion(), phase=useRef(new Animated.Value(0)).current;
 const active=animated&&!reduced;
 useEffect(()=>{
  phase.setValue(0);
  if(!active)return;
  const anim=Animated.loop(Animated.timing(phase,{toValue:1,duration:kind==='flock'||kind==='alpr'?2400:1800,easing:Easing.linear,useNativeDriver:true,isInteraction:false}));
  anim.start();return()=>anim.stop();
 },[phase,active,kind]);
 const breathe=active?phase.interpolate({inputRange:[0,.5,1],outputRange:[.35,.95,.35]}):.8;
 const scan=active?phase.interpolate({inputRange:[0,.5,1],outputRange:[-8,8,-8]}):0;
 const angle=active?phase.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']}):'0deg';
 return <View accessibilityLabel={d.label+' marker design'} style={s.large}>
  <Animated.View style={[s.ground,{backgroundColor:d.color,opacity:breathe,shadowColor:d.color}]}/>
  <Animated.View style={[s.glow,{opacity:breathe,shadowColor:d.color}]}><MaterialCommunityIcons name="shield" size={120} color={d.color}/></Animated.View>
  <MaterialCommunityIcons name="shield" size={120} color="#151C22" style={s.shield}/>
  <MaterialCommunityIcons name="shield-outline" size={120} color={d.color} style={s.shield}/>
  <MaterialCommunityIcons name="shield-outline" size={104} color={d.color} style={[s.shield,{left:30,top:14,opacity:.5}]}/>
  {(kind==='speed'||kind==='radar')&&[0,1,2].map(i=>{
   const delay=.18*i, opacity=active?phase.interpolate({inputRange:[0,delay+.07,delay+.22,Math.min(.98,delay+.45),1],outputRange:[.23,1,.85,.23,.23]}):.9;
   return <Animated.View key={i} pointerEvents="none" style={[s.wave,{top:39-i*7,left:21-i*9,width:122+i*18,height:52+i*14,borderLeftColor:d.color,borderRightColor:d.color,opacity}]}/>;
  })}
  {kind==='radar'?<View style={[s.radar,{borderColor:d.color}]}>
    <View style={[s.radarInner,{borderColor:d.color}]}/><Animated.View style={[s.sweep,{backgroundColor:d.color,transform:[{rotate:angle}]}]}/>
    <View style={[s.radarDot,{backgroundColor:d.color}]}/>
  </View>:<MaterialCommunityIcons name={d.glyph} color={d.color} size={kind==='flock'||kind==='alpr'?30:46} style={{position:'absolute',top:kind==='flock'||kind==='alpr'?25:33,left:kind==='flock'||kind==='alpr'?67:59}}/>}
  <Text style={[s.label,{color:d.color,top:kind==='flock'||kind==='alpr'?57:83}]}>{d.label}</Text>
  {(kind==='flock'||kind==='alpr')&&<View style={[s.plate,{borderColor:d.color}]}>
   <Text style={s.plateText}>ABC 123</Text><Animated.View style={[s.scan,{backgroundColor:'#BDF5FF',shadowColor:d.color,transform:[{translateY:scan}]}]}/>
  </View>}
 </View>;
}
export function CameraMarkerDetails({pin,onClose}:{pin:CameraPin|null;onClose:()=>void}){
 return <Modal transparent visible={!!pin} animationType="fade" onRequestClose={onClose}>
  <View style={s.backdrop}>
   {pin&&<View style={s.panel} accessibilityViewIsModal>
    <IntelMarker kind={pin.marker}/>
    <Text style={s.title}>{pin.title}</Text>
    <Text style={s.detail}>{pin.detail}</Text>
    <Text style={s.detail}>{pin.license} / snapshot date {pin.lastChecked}. Location and operating status may be incomplete.</Text>
    <Pressable accessibilityRole="link" onPress={()=>void Linking.openURL(pin.sourceUrl).catch(()=>{})}><Text style={s.link}>View source</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onClose} style={s.close}><Text style={s.closeText}>DONE</Text></Pressable>
   </View>}
  </View>
 </Modal>;
}
const s=StyleSheet.create({
 compact:{width:32,height:35,alignItems:'center'},compactShield:{position:'absolute',top:0,left:2},miniLabel:{position:'absolute',top:24,fontSize:7,fontWeight:'800',backgroundColor:'#10161B',paddingHorizontal:2},
 large:{width:164,height:142,alignSelf:'center'},shield:{position:'absolute',left:22,top:5},glow:{position:'absolute',left:22,top:5,shadowOpacity:1,shadowRadius:15,shadowOffset:{width:0,height:0}},ground:{position:'absolute',left:40,top:116,width:84,height:9,borderRadius:40,shadowOpacity:1,shadowRadius:17,shadowOffset:{width:0,height:0}},wave:{position:'absolute',borderRadius:60,borderWidth:2,borderTopColor:'transparent',borderBottomColor:'transparent'},label:{position:'absolute',left:20,right:20,textAlign:'center',fontSize:11,fontWeight:'900',letterSpacing:1.1},plate:{position:'absolute',top:73,left:55,width:54,height:24,borderRadius:4,borderWidth:1,backgroundColor:'#0A1620',alignItems:'center',justifyContent:'center',overflow:'hidden'},plateText:{fontSize:9,fontWeight:'800',color:'#BDE8FB'},scan:{position:'absolute',top:11,left:2,right:2,height:2,shadowOpacity:1,shadowRadius:6,shadowOffset:{width:0,height:0}},radar:{position:'absolute',top:31,left:57,width:50,height:50,borderWidth:1,borderRadius:25,alignItems:'center',justifyContent:'center',overflow:'hidden'},radarInner:{width:30,height:30,borderRadius:15,borderWidth:1,opacity:.6},sweep:{position:'absolute',width:46,height:1,opacity:.9},radarDot:{position:'absolute',width:5,height:5,borderRadius:3},backdrop:{flex:1,justifyContent:'center',padding:24,backgroundColor:'#000A'},panel:{padding:20,borderRadius:16,borderWidth:1,borderColor:'#55646D',backgroundColor:'#10171D',gap:12},title:{fontSize:19,fontWeight:'700',color:'#F6E7CD',textAlign:'center'},detail:{fontSize:13,lineHeight:19,color:'#C0CCD2'},link:{color:'#DCC295',paddingVertical:9},close:{minHeight:44,backgroundColor:'#DCC295',borderRadius:24,alignItems:'center',justifyContent:'center'},closeText:{fontWeight:'800',color:'#15130E'},
});
