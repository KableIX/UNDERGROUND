import { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

type Phase = 'ready' | 'running' | 'finished';

function StopwatchDial({ running }: { running: boolean }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!running) return;
    rotation.setValue(0);
    const spin = Animated.loop(Animated.timing(rotation, {
      toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    }));
    spin.start();
    return () => spin.stop();
  }, [rotation, running]);

  return <View style={styles.dial} accessible={false}>
    <View style={styles.crown} />
    <View style={styles.case}>
      {[0, 90, 180, 270].map(angle => <View key={angle} style={[styles.rotor, { transform: [{rotate: angle + 'deg'}] }]}>
        <View style={styles.tick} />
      </View>)}
      <Animated.View testID="run-stopwatch-hand" style={[styles.rotor, { transform: [{rotate: rotation.interpolate({
        inputRange: [0, 1], outputRange: ['0deg', '360deg'],
      })}] }]}>
        <View style={styles.hand} />
      </Animated.View>
      <View style={styles.hub} />
    </View>
  </View>;
}

export function RunClock({ phase, elapsedMs, paused, cruise = false }: { phase: Phase; elapsedMs: number; paused?: boolean; cruise?: boolean }) {
  const sweep = useRef(new Animated.Value(1)).current;
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let receivedChange = false;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', value => {
      receivedChange = true;
      if (active) setReducedMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active && !receivedChange) setReducedMotion(value);
    }).catch(() => {});
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (reducedMotion || phase === 'running') return;
    sweep.setValue(0);
    const motion = Animated.timing(sweep, { toValue: 1, duration: 620, useNativeDriver: Platform.OS !== 'web' });
    motion.start();
    return () => { motion.stop(); sweep.setValue(1); };
  }, [phase, reducedMotion, sweep]);
  const seconds = Math.floor(Math.max(0, elapsedMs) / 1000);
  const time = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':');
  const label = cruise ? (phase === 'finished' ? 'Cruise completed' : phase === 'ready' ? 'Starting line' : 'Cruising') : phase === 'finished' ? 'Finish time' : phase === 'ready' ? 'Starting line' : paused ? 'Time paused' : 'Elapsed time';
  return (
    <View style={styles.row} accessible accessibilityLabel={cruise ? label : label + ', ' + time}>
      <Animated.View style={{ transform: [{ rotate: sweep.interpolate({
        inputRange: [0, 0.4, 0.75, 1], outputRange: ['-22deg', '12deg', '-6deg', '0deg'],
      }) }] }}>
        {phase === 'running' && !cruise ? <StopwatchDial running={!paused && !reducedMotion} /> :
          phase === 'running' ? <Ionicons name="navigate-outline" size={24} color="#E4CC99" /> :
          <FontAwesome name={phase === 'ready' ? 'flag' : 'flag-checkered'} size={24} color={phase === 'ready' ? '#A7ED77' : '#FFFFFF'} />}
      </Animated.View>
      {cruise ? <Text style={styles.label}>{label}</Text> :
        <View style={styles.digits} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Text allowFontScaling={false} adjustsFontSizeToFit numberOfLines={1} style={[styles.time,styles.halo]}>{time}</Text>
          <Text allowFontScaling={false} adjustsFontSizeToFit numberOfLines={1} style={styles.time}>{time}</Text>
        </View>}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, alignSelf: 'center', maxWidth: '100%', paddingHorizontal: 8 },
  dial: { width: 43, height: 48, alignItems: 'center', justifyContent: 'flex-end' },
  crown: { position: 'absolute', top: 0, height: 6, width: 12, borderRadius: 2, backgroundColor: '#FFD4A1' },
  case: { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, borderColor: '#FFB873',
    backgroundColor: 'rgba(36,20,11,0.72)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF821F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 4 },
  rotor: { position: 'absolute', width: 34, height: 34, alignItems: 'center' },
  tick: { width: 1.5, height: 3.5, backgroundColor: '#F4AF76', borderRadius: 1 },
  hand: { position: 'absolute', top: 4, width: 2.5, height: 16, borderRadius: 2, backgroundColor: '#FFE0AF' },
  hub: { width: 5.5, height: 5.5, borderRadius: 3, backgroundColor: '#FFAD5D' },
  digits: { flexShrink: 1, minWidth: 0 },
  label: { color: '#DFCBA7', fontSize: 14 },
  time: { color: '#FFBE75', fontFamily: 'RunDigits', fontSize: 65, lineHeight: 68, includeFontPadding: false,
    textShadowColor: '#FF821F', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  halo: { position: 'absolute', top: 0, left: 0, right: 0, color: '#6B320C',
    textShadowColor: '#FF7317', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 11 },
});
