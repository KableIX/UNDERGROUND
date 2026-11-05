import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { isExpoLinearGradientNativeAvailable } from '../../lib/native-module-probe';

type Props = {
  colors: readonly string[];
  locations?: readonly number[] | null;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
};

/**
 * Renders expo-linear-gradient only when the native view manager is linked.
 * Mismatched Metro↔IPA pairs otherwise crash welcome with
 * Unimplemented component: ViewManagerAdapter_ExpoLinearGradient.
 */
export function SafeLinearGradient({
  colors,
  locations,
  start,
  end,
  style,
  children,
  pointerEvents,
}: Props) {
  if (!isExpoLinearGradientNativeAvailable()) {
    const top = colors[0] ?? '#05070C';
    const mid = colors[Math.floor(colors.length / 2)] ?? top;
    const bottom = colors[colors.length - 1] ?? top;
    return (
      <View style={[styles.fallbackRoot, style]} pointerEvents={pointerEvents}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: top, opacity: 1 }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: mid, opacity: 0.55 }]} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: bottom, opacity: 0.35 }]} />
        {children}
      </View>
    );
  }

  // Lazy require so Node/tests never load the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LinearGradient } = require('expo-linear-gradient') as typeof import('expo-linear-gradient');
  const gradientColors = colors as [string, string, ...string[]];
  const gradientLocations = locations
    ? (locations as [number, number, ...number[]])
    : undefined;
  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      start={start}
      end={end}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fallbackRoot: {
    overflow: 'hidden',
  },
});
