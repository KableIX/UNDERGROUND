import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/*
 * Drawn over the frozen photo while the vision model works: a fine gold sweep
 * with a soft trail, a faint grid shimmer, and corner brackets that draw in and
 * then close on the car when the answer lands. Reduce Motion keeps the brackets
 * and grid still and drops the sweep.
 */

export const GOLD = '#E7C892';
const GLOW = '#E6B755';

export function Brackets({ inset, locked, size = 30 }: { inset: Animated.AnimatedInterpolation<number> | number; locked?: boolean; size?: number }) {
  const color = locked ? '#FFF0C8' : GOLD;
  const line = { position: 'absolute' as const, backgroundColor: color };
  const corner = (v: 'top' | 'bottom', h: 'left' | 'right') => (
    <Animated.View
      key={v + h}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        [v]: inset,
        [h]: inset,
        shadowColor: GLOW,
        shadowOpacity: locked ? 0.95 : 0.55,
        shadowRadius: locked ? 8 : 4,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <View style={[line, { [v]: 0, [h]: 0, width: size, height: 1.5 }]} />
      <View style={[line, { [v]: 0, [h]: 0, width: 1.5, height: size }]} />
    </Animated.View>
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {corner('top', 'left')}
      {corner('top', 'right')}
      {corner('bottom', 'left')}
      {corner('bottom', 'right')}
    </View>
  );
}

function Grid({ opacity }: { opacity: Animated.AnimatedInterpolation<number> | Animated.Value | number }) {
  const cols = 8;
  const rows = 6;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      {Array.from({ length: cols - 1 }, (_, i) => (
        <View key={'c' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${((i + 1) * 100) / cols}%`, width: StyleSheet.hairlineWidth, backgroundColor: GOLD }} />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <View key={'r' + i} style={{ position: 'absolute', left: 0, right: 0, top: `${((i + 1) * 100) / rows}%`, height: StyleSheet.hairlineWidth, backgroundColor: GOLD }} />
      ))}
    </Animated.View>
  );
}

export function ScanOverlay({ locked, reduceMotion }: { locked: boolean; reduceMotion: boolean }) {
  const [h, setH] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const close = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion || locked || h === 0) return;
    const run = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweep, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(160),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.timing(close, { toValue: 0.55, duration: 2600, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]);
    run.start();
    return () => run.stop();
  }, [close, h, locked, reduceMotion, shimmer, sweep]);

  useEffect(() => {
    if (!locked) return;
    if (reduceMotion) {
      close.setValue(1);
      return;
    }
    Animated.parallel([
      Animated.timing(close, { toValue: 1, duration: 360, easing: Easing.out(Easing.back(1.6)), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();
  }, [close, flash, locked, reduceMotion]);

  const inset = close.interpolate({ inputRange: [0, 1], outputRange: [10, 34] });
  const y = sweep.interpolate({ inputRange: [0, 1], outputRange: [-90, h] });
  const gridOpacity = reduceMotion ? 0.07 : shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.035, 0.12] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height)}>
      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <Grid opacity={gridOpacity} />
      {!reduceMotion && !locked && h > 0 ? (
        <Animated.View style={{ position: 'absolute', left: 0, right: 0, height: 92, transform: [{ translateY: y }] }}>
          <LinearGradient colors={['rgba(231,200,146,0)', 'rgba(231,200,146,0.05)', 'rgba(231,200,146,0.22)']} locations={[0, 0.6, 1]} style={{ flex: 1 }} />
          <View style={{ height: 1.5, backgroundColor: '#FBE7B8', shadowColor: GLOW, shadowOpacity: 1, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }} />
        </Animated.View>
      ) : null}
      <Brackets inset={inset} locked={locked} />
      <Animated.View style={[StyleSheet.absoluteFill, { borderWidth: 1, borderColor: '#FFF0C8', opacity: flash }]} />
    </View>
  );
}
