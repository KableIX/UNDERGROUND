import {StyleSheet,View,Text} from 'react-native';

export const goldTouch = {
 borderColor:'#E7C892',
 shadowColor:'#E6B755',
 shadowOpacity:.75,
 shadowRadius:12,
 shadowOffset:{width:0,height:0},
 elevation:7,
 backgroundColor:'#30261A',
} as const;

export function UndergroundBrand(){
 return <View accessibilityLabel="UNDERGROUND Driver's Club" style={s.brand}>
  <View style={s.mark}>
   <View style={[s.rail,{left:4,top:0,transform:[{rotate:'-13deg'}]}]}/>
   <View style={[s.rail,{right:4,top:0,transform:[{rotate:'13deg'}]}]}/>
   <View style={[s.join,{left:7,top:17,transform:[{rotate:'40deg'}]}]}/>
   <View style={[s.join,{right:7,top:17,transform:[{rotate:'-40deg'}]}]}/>
   <View style={s.tip}/>
  </View>
  <Text numberOfLines={1} style={s.wordmark}>UNDERGROUND</Text>
  <Text style={s.sub}>DRIVER'S CLUB</Text>
 </View>;
}
const s=StyleSheet.create({
 brand:{alignItems:'center',justifyContent:'center',width:168,gap:1},
 mark:{width:34,height:29},
 rail:{position:'absolute',width:5,height:20,backgroundColor:'#D8B977',borderTopWidth:1,borderTopColor:'#FFF0CA',shadowColor:'#D8B977',shadowOpacity:.5,shadowRadius:5,shadowOffset:{width:0,height:0}},
 join:{position:'absolute',width:5,height:13,backgroundColor:'#E2C48A'},
 tip:{position:'absolute',left:14,top:23,width:6,height:5,backgroundColor:'#E2C48A',transform:[{rotate:'45deg'}]},
 wordmark:{fontSize:15,fontFamily:'Cinzel_600SemiBold',letterSpacing:2,color:'#F2DEB3',textShadowColor:'#C5A572',textShadowRadius:5,textShadowOffset:{width:0,height:0}},
 sub:{fontSize:8,letterSpacing:3,color:'#C5A572',fontWeight:'600'},
});
