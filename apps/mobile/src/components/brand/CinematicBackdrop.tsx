import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeLinearGradient } from './SafeLinearGradient';

/** Uses the same garage hero photography, dark scrim and minimal surfaces
 * as theunderground.vip. Keep the official tach/U logo in UndergroundMark.
 */
export function CinematicBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../../assets/brand/garage.jpg')}
        style={styles.photo}
        resizeMode="cover"
      />
      <View style={styles.scrim} />
      <SafeLinearGradient
        colors={['rgba(0,0,0,0.74)', 'rgba(8,9,10,0.50)', 'rgba(8,9,10,0.97)']}
        locations={[0, 0.42, 1]}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090a' },
  photo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.78,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
