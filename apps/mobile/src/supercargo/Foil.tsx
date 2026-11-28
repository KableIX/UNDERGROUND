import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Finish } from './scan';
import type { FoilMotion } from './useFoilMotion';

/*
 * Card finishes. Holo: a full holographic gold foil with a foil border and a few
 * sparkles. Sheen: a foil edge and one soft light pass. Matte: neither.
 * With device motion (`motion`, from a build that has expo-sensors) the light band
 * and a specular glow follow the tilt of the phone. Without it the foil drifts on
 * its own. Reduce Motion freezes every finish at a fixed angle.
 */

const HOLO_BORDER = ['#7A5A24', '#F7E4AE', '#B38638', '#FFF3D0', '#9C7432', '#E9CE8E', '#7A5A24'] as const;
const SHEEN_BORDER = ['#4A3C26', '#CDB27C', '#5E4C30', '#B89C66', '#4A3C26'] as const;
const HOLO_FILM = [
  'rgba(255,226,160,0)',
  'rgba(255,220,150,0.20)',
  'rgba(160,236,255,0.13)',
  'rgba(255,175,225,0.12)',
  'rgba(255,232,170,0.22)',
  'rgba(190,255,220,0.10)',
  'rgba(255,226,160,0)',
] as const;
const SHEEN_FILM = ['rgba(255,240,205,0)', 'rgba(255,240,205,0.10)', 'rgba(255,240,205,0)'] as const;

/** Outer frame: a gold foil border for holo, a darker foil edge for sheen, a hairline for matte. */
export function FoilFrame({ finish, children, style }: { finish: Finish; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  if (finish === 'matte') return <View style={[s.matte, style]}>{children}</View>;
  return (
    <LinearGradient
      colors={finish === 'holo' ? HOLO_BORDER : SHEEN_BORDER}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ padding: finish === 'holo' ? 2 : 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

function useLoop(active: boolean, duration: number, pingPong: boolean) {
  const v = useRef(new Animated.Value(active ? 0 : 0.35)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0.35);
      return;
    }
    const run = pingPong
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        )
      : Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
            Animated.delay(duration * 1.4),
            Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        );
    run.start();
    return () => run.stop();
  }, [active, duration, pingPong, v]);
  return v;
}

const SPARKS = [
  { x: 0.16, y: 0.12, size: 9, delay: 0 },
  { x: 0.82, y: 0.2, size: 7, delay: 900 },
  { x: 0.7, y: 0.62, size: 10, delay: 1700 },
  { x: 0.24, y: 0.78, size: 6, delay: 2600 },
  { x: 0.9, y: 0.9, size: 8, delay: 3300 },
];

function Spark({ x, y, size, delay, still }: { x: number; y: number; size: number; delay: number; still: boolean }) {
  const o = useRef(new Animated.Value(still ? 0.5 : 0)).current;
  useEffect(() => {
    if (still) return;
    const run = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(o, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(o, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.delay(4200 - delay),
      ]),
    );
    run.start();
    return () => run.stop();
  }, [delay, o, still]);
  const arm = { position: 'absolute' as const, backgroundColor: '#FFF6DC', borderRadius: 1 };
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: size * 2,
        height: size * 2,
        opacity: o,
        transform: [{ rotate: '45deg' }],
        shadowColor: '#FFE7A6',
        shadowOpacity: 0.9,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
      }}
    >
      <View style={[arm, { left: size - 0.5, top: 0, width: 1, height: size * 2 }]} />
      <View style={[arm, { top: size - 0.5, left: 0, height: 1, width: size * 2 }]} />
    </Animated.View>
  );
}

/** Light film laid over a finished card. Pointer events pass through. */
export function FoilFilm({ finish, reduceMotion, sparkle = true, motion = null }: { finish: Finish; reduceMotion: boolean; sparkle?: boolean; motion?: FoilMotion | null }) {
  const [width, setWidth] = useState(0);
  const holo = finish === 'holo';
  const t = useLoop(finish !== 'matte' && !reduceMotion && !motion && width > 0, holo ? 5200 : 2400, holo);
  if (finish === 'matte') return null;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const band = Math.max(1, width) * (holo ? 3 : 1.4);
  const range = holo ? [-band * 0.62, -band * 0.02] : [-band, width];
  const translateX = motion ? motion.band.interpolate({ inputRange: [-1, 1], outputRange: range }) : t.interpolate({ inputRange: [0, 1], outputRange: holo ? [-band * 0.62, 0] : [-band, width] });
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={onLayout}>
      {holo ? (
        <LinearGradient
          colors={['rgba(255,214,140,0.10)', 'rgba(255,214,140,0)', 'rgba(255,214,140,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {width > 0 ? (
        <Animated.View style={{ position: 'absolute', top: '-30%', bottom: '-30%', left: 0, width: band, transform: [{ translateX }, { rotate: '-18deg' }] }}>
          <LinearGradient colors={holo ? HOLO_FILM : SHEEN_FILM} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      {motion && width > 0 ? (
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: width * 0.05,
            width: width * 0.9,
            opacity: motion.glow,
            transform: [{ translateX: motion.band.interpolate({ inputRange: [-1, 1], outputRange: [-width * 0.55, width * 0.55] }) }],
          }}
        >
          <LinearGradient colors={['rgba(255,246,220,0)', 'rgba(255,246,220,0.22)', 'rgba(255,246,220,0)']} start={{ x: 0, y: 0.25 }} end={{ x: 1, y: 0.75 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
      {holo && sparkle ? SPARKS.map((p, i) => <Spark key={i} {...p} still={reduceMotion} />) : null}
    </View>
  );
}

const s = StyleSheet.create({
  matte: { borderWidth: 1, borderColor: '#2C2D31' },
});
