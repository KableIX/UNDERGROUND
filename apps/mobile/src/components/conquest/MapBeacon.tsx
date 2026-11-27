import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { SV_LANDMARK_CAMERA } from '../../data/landmarks';

export const campusPoint = { latitude: SV_LANDMARK_CAMERA.latitude, longitude: SV_LANDMARK_CAMERA.longitude };
// The luminous core lies at (54, 84) inside a 144 x 132 marker.
export const beaconAnchor = { x: 54 / 144, y: 84 / 132 };

// Both renderers pin the luminous core to the GPS coordinate. The wider canvas
// leaves room for a detached flag without clipping native marker snapshots.
const locationWidth = 180;
export const locationAnchor = { x: 54 / locationWidth, y: beaconAnchor.y };
export const locationCenterOffset = { x: locationWidth / 2 - 54, y: 132 / 2 - 84 };

export function BeaconLight({ location }: { location: boolean }) {
  return <>
    <Image fadeDuration={0} style={styles.light} source={location ? require('../../../assets/map/teal-beacon.png') : require('../../../assets/map/amber-beacon.png')} />
    <View style={[styles.ring, { borderColor: location ? '#75FFF1' : '#FFC36B' }]} />
    <View style={[styles.core, { shadowColor: location ? '#53FFEC' : '#FFB03D' }]} />
  </>;
}

function MeetupLight() {
  const phase = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(phase, {toValue:1,duration:2400,easing:Easing.linear,useNativeDriver:true}));
    animation.start();
    return () => animation.stop();
  }, [phase]);
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {[0,1,2,3,4].map(i => <Animated.View key={i} style={[styles.smoke,{left:42+i*3,opacity:phase.interpolate({inputRange:[0,0.25,1],outputRange:[0,0.40-i*0.045,0]}),transform:[{translateY:phase.interpolate({inputRange:[0,1],outputRange:[0,-48-i*6]})},{translateX:phase.interpolate({inputRange:[0,1],outputRange:[0,(i-2)*9]})},{scale:phase.interpolate({inputRange:[0,1],outputRange:[0.55,2.8]})}]}]} />)}
    <View style={styles.redHalo}/>
    <View style={styles.redCore}/>
    <View style={styles.redPin}/>
  </View>;
}

export function MapBeacon({ label, location = false }: { label: string; location?: boolean }) {
  const meetup = !location && label === 'MEETUP';
  const tint = meetup ? '#FF4545' : location ? '#77E8D9' : '#EDAD5E';
  return (
    <View collapsable={false} accessible accessibilityLabel={label} style={[styles.marker, location && styles.locationMarker]}>
      {meetup ? <MeetupLight /> : <BeaconLight location={location} />}
      <View style={[styles.leader, location && styles.locationLeader, { backgroundColor: tint }]} />
      <Text numberOfLines={1} style={[styles.label, location && styles.locationLabel, { borderColor: tint }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  smoke: {position:'absolute',top:64,width:22,height:25,borderRadius:15,backgroundColor:'#D74B4B',shadowColor:'#FF3434',shadowOpacity:0.9,shadowRadius:12,shadowOffset:{width:0,height:0}},
  redHalo: {position:'absolute',left:35,top:65,width:38,height:38,borderRadius:19,backgroundColor:'rgba(255,28,36,0.19)',shadowColor:'#FF2028',shadowOpacity:1,shadowRadius:17,shadowOffset:{width:0,height:0}},
  redCore: {position:'absolute',left:47,top:77,width:14,height:14,borderRadius:7,backgroundColor:'#FF272F',shadowColor:'#FF2929',shadowOpacity:1,shadowRadius:12,shadowOffset:{width:0,height:0}},
  redPin: {position:'absolute',left:51,top:81,width:6,height:6,borderRadius:3,backgroundColor:'#FFF0E8'},

  marker: { width: 144, height: 132 },
  locationMarker: { width: locationWidth },
  locationLeader: { left: 65, top: 52, width: 55, height: 2, transform: [{ rotate: '-39deg' }] },
  locationLabel: { left: 109, top: 14, maxWidth: 71, paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: '#08131C', borderWidth: 1, borderRadius: 4, color: '#FFFFFF', fontSize: 17, lineHeight: 22 },
  ring: { position: 'absolute', left: 44, top: 74, width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  core: { position: 'absolute', left: 50, top: 80, width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#F5FFFF', shadowOpacity: 1, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  light: { position: 'absolute', width: 108, height: 132 },
  leader: { position: 'absolute', left: 57, top: 75, width: 17, height: 1, transform: [{ rotate: '-38deg' }] },
  label: { position: 'absolute', left: 69, top: 51, maxWidth: 75, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 0.7, borderRadius: 3, backgroundColor: '#09121BEA', color: '#F5F5F2', fontFamily: 'BarlowCondensed_700Bold', fontSize: 13 },
});
