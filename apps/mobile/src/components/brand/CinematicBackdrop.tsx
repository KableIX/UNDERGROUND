import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { shell } from '../../theme/shell';
import { SafeLinearGradient } from './SafeLinearGradient';

/** Soft charcoal gradient atmosphere — not a flat fill. */
export function CinematicBackdrop({ children }: { children: ReactNode }) {
  return (
    <View style={styles.root}>
      <SafeLinearGradient
        colors={['#05070C', '#0A0B0D', '#12141A', '#05070C']}
        locations={[0, 0.35, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeLinearGradient
        colors={['transparent', 'rgba(197,165,114,0.06)', 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: shell.mapVoid,
  },
});
