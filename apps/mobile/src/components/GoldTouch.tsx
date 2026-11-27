import {Image} from 'react-native';

export const goldTouch = {
 borderColor:'#E7C892',
 shadowColor:'#E6B755',
 shadowOpacity:.75,
 shadowRadius:12,
 shadowOffset:{width:0,height:0},
 elevation:7,
 backgroundColor:'#30261A',
} as const;

// Approved concept lockup, without the subtitle or a substitute typeface.
export function UndergroundBrand(){
 return <Image accessibilityLabel="UNDERGROUND" resizeMode="contain"
  source={require('../../assets/brand/underground-concept-logo.png')} style={{width:184,height:36}}/>;
}
