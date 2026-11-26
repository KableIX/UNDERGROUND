import { Image, StyleSheet, Text, View } from 'react-native';
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

export function MapBeacon({ label, location = false }: { label: string; location?: boolean }) {
  const tint = location ? '#77E8D9' : '#EDAD5E';
  return (
    <View collapsable={false} accessible accessibilityLabel={label} style={[styles.marker, location && styles.locationMarker]}>
      <BeaconLight location={location} />
      <View style={[styles.leader, location && styles.locationLeader, { backgroundColor: tint }]} />
      <Text numberOfLines={1} style={[styles.label, location && styles.locationLabel, { borderColor: tint }]}>{label}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
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
