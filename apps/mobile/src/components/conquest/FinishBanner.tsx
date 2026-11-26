import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

const square = 20;
const holdMs = 300;
const flyThroughMs = 1000;

export function FinishBanner() {
  const { width } = useWindowDimensions();
  const columns = Math.ceil(width / square);
  const progress = useRef(new Animated.Value(0)).current;
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 4.5] });
  const opacity = progress.interpolate({ inputRange: [0, 0.26, 1], outputRange: [1, 1, 0] });
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let reduced = true;
    let changed = false;
    let mounted = true;
    let motion: Animated.CompositeAnimation | undefined;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      changed = true;
      reduced = value;
      if (value && motion) { motion.stop(); setVisible(false); }
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted && !changed) reduced = value;
    }).catch(() => {});
    const timer = setTimeout(() => {
      if (reduced) { setVisible(false); return; }
      motion = Animated.timing(progress, {
        toValue: 1, duration: flyThroughMs, easing: Easing.in(Easing.quad),
        useNativeDriver: Platform.OS !== 'web', isInteraction: false,
      });
      motion.start(({ finished }) => { if (mounted && finished) setVisible(false); });
    }, holdMs);
    return () => {
      mounted = false;
      clearTimeout(timer);
      subscription.remove();
      motion?.stop();
    };
  }, [progress]);

  if (!visible) return null;
  return <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View testID="finish-banner" style={[styles.ribbon, { opacity, transform: [{ scale }] }]}>
      {[0, 1, 2, 3].map(row => <View key={row} style={styles.row}>
        {Array.from({length: columns}, (_, col) => <View key={col} style={[styles.tile, (row + col) % 2 === 0 && styles.light]} />)}
      </View>)}
      <View style={styles.center}><Text style={styles.title}>FINISH</Text></View>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', overflow: 'hidden', zIndex: 5 },
  ribbon: { width: '100%', overflow: 'hidden', backgroundColor: '#111519', borderColor: '#F2F2EC', borderTopWidth: 1, borderBottomWidth: 1 },
  row: { flexDirection: 'row' },
  tile: { width: square, height: square, flexShrink: 0 },
  light: { backgroundColor: '#F2F2EC' },
  center: { position: 'absolute', alignSelf: 'center', top: 0, bottom: 0, justifyContent: 'center', backgroundColor: '#111519', paddingHorizontal: 22 },
  title: { color: '#FFFFFF', fontFamily: 'BarlowCondensed_700Bold', fontSize: 38, letterSpacing: 3 },
});
