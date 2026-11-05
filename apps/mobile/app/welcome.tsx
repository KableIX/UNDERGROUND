import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import { CinematicBackdrop } from '../src/components/brand/CinematicBackdrop';
import { UndergroundMark } from '../src/components/brand/UndergroundMark';
import { useSession } from '../src/session/SessionContext';
import { shell } from '../src/theme/shell';

/**
 * Cinematic member entrance, without delaying authenticated users.
 * All effects are local: no remote image/video, analytics, or GPS permission.
 * Reduced-motion users receive the full screen immediately.
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, canDevBypass, enterDevBypass } = useSession();
  const markOpacity = useRef(new Animated.Value(0)).current;
  const markScale = useRef(new Animated.Value(0.92)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkRise = useRef(new Animated.Value(18)).current;
  const actionsOpacity = useRef(new Animated.Value(0)).current;
  const [introComplete, setIntroComplete] = useState(false);
  const animation = useRef<Animated.CompositeAnimation | null>(null);

  const completeIntro = useCallback(() => {
    animation.current?.stop();
    markOpacity.setValue(1);
    markScale.setValue(1);
    wordmarkOpacity.setValue(1);
    wordmarkRise.setValue(0);
    actionsOpacity.setValue(1);
    setIntroComplete(true);
  }, [markOpacity, markScale, wordmarkOpacity, wordmarkRise, actionsOpacity]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted) return;
      if (reduceMotion) {
        completeIntro();
        return;
      }
      const sequence = Animated.sequence([
        Animated.parallel([
          Animated.timing(markOpacity, { toValue: 1, duration: 540, useNativeDriver: true }),
          Animated.spring(markScale, { toValue: 1, damping: 17, stiffness: 95, mass: 1, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(wordmarkOpacity, { toValue: 1, duration: 520, useNativeDriver: true }),
          Animated.timing(wordmarkRise, { toValue: 0, duration: 520, useNativeDriver: true }),
        ]),
        Animated.timing(actionsOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      ]);
      animation.current = sequence;
      sequence.start(({ finished }) => {
        if (mounted && finished) setIntroComplete(true);
      });
    }).catch(() => {
      if (mounted) completeIntro();
    });
    return () => {
      mounted = false;
      animation.current?.stop();
    };
  }, [completeIntro, markOpacity, markScale, wordmarkOpacity, wordmarkRise, actionsOpacity]);

  if (state.status === 'authenticated') return <Redirect href="/(tabs)" />;

  return (
    <CinematicBackdrop>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 24 },
        ]}
        accessibilityLabel="UNDERGROUND private members entrance"
      >
        <View style={styles.topLine}>
          <Text variant="caption" style={styles.miniBrand}>UNDERGROUND / PRIVATE SOCIETY</Text>
          <Text variant="caption" style={styles.miniBrand}>EST. 2026</Text>
        </View>

        <View style={styles.center}>
          <Animated.View style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}>
            <View style={styles.markFrame}>
              <UndergroundMark size="hero" showWordmark={false} showTagline={false} />
            </View>
          </Animated.View>

          <Animated.View
            style={{ opacity: wordmarkOpacity, transform: [{ translateY: wordmarkRise }] }}
          >
            <Text variant="brand" gold style={styles.wordmark}>UNDERGROUND</Text>
            <View style={styles.goldRule} />
            <Text variant="caption" style={styles.manifesto}>OWNERSHIP IS THE ENTRY.</Text>
            <Text style={styles.caption}>
              PRIVATE ROADS. REAL PEOPLE. REAL MACHINES.
            </Text>
          </Animated.View>
        </View>

        <View style={styles.bottom}>
          <Animated.View
            pointerEvents={introComplete ? 'auto' : 'none'}
            style={[styles.actions, { opacity: actionsOpacity }]}
          >
            <Text style={styles.lede}>
              An invitation-only society for verified exotic-car owners.
            </Text>
            <Pressable
              style={styles.primary}
              onPress={() => router.push('/login')}
              accessibilityRole="button"
              accessibilityLabel="Existing member sign in"
            >
              <Text variant="caption" gold>EXISTING MEMBER</Text>
            </Pressable>
            <Pressable
              style={styles.secondary}
              onPress={() => router.push('/invite')}
              accessibilityRole="button"
              accessibilityLabel="Redeem invitation"
            >
              <Text variant="caption" gold>REDEEM INVITATION</Text>
            </Pressable>
            {canDevBypass ? (
              <Pressable
                style={styles.dev}
                onPress={() => {
                  const result = enterDevBypass();
                  if (result.ok) router.replace('/(tabs)');
                }}
                accessibilityRole="button"
                accessibilityLabel="Development bypass as founder"
              >
                <Text variant="caption" style={styles.devLabel}>DEV BYPASS · STARK #000001</Text>
              </Pressable>
            ) : null}
          </Animated.View>
          {!introComplete ? (
            <Pressable
              style={styles.skip}
              accessibilityRole="button"
              accessibilityLabel="Skip introduction"
              onPress={completeIntro}
            >
              <Text variant="caption" style={styles.skipText}>SKIP INTRO</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </CinematicBackdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  topLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.24)',
  },
  miniBrand: { color: shell.muted, fontSize: 9, letterSpacing: 1.3 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  markFrame: {
    padding: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.15)',
  },
  wordmark: { marginTop: 15, textAlign: 'center', fontSize: 28, letterSpacing: 3.6 },
  goldRule: {
    width: 64, height: 1, alignSelf: 'center', marginTop: 17,
    marginBottom: 18, backgroundColor: shell.accent,
  },
  manifesto: { color: shell.text, letterSpacing: 3, textAlign: 'center' },
  caption: {
    color: shell.muted, textAlign: 'center', marginTop: 16, fontSize: 10,
    letterSpacing: 1.5,
  },
  bottom: { minHeight: 216, justifyContent: 'flex-end' },
  actions: { gap: 12 },
  lede: {
    color: shell.muted, marginBottom: 10, textAlign: 'center',
    fontSize: 12, lineHeight: 20,
  },
  primary: {
    paddingVertical: 17, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: shell.accent,
    backgroundColor: 'rgba(197,165,114,0.08)',
  },
  secondary: {
    paddingVertical: 17, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(197,165,114,0.33)',
  },
  dev: { marginTop: 6, paddingVertical: 11, alignItems: 'center' },
  devLabel: { color: shell.muted, letterSpacing: 1.2, fontSize: 10 },
  skip: { position: 'absolute', bottom: 2, alignSelf: 'center', padding: 10 },
  skipText: { color: shell.muted, letterSpacing: 1.4 },
});
