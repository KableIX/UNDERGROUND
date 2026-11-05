import { useEffect, useRef } from 'react';
import {
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

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, canDevBypass, enterDevBypass } = useSession();
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]).start();
  }, [opacity, rise]);

  if (state.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <CinematicBackdrop>
      <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={{ opacity, transform: [{ translateY: rise }] }}>
          <UndergroundMark size="hero" showWordmark showTagline />
        </Animated.View>

        <Animated.View style={[styles.actions, { opacity }]}>
          <Text style={styles.lede}>
            A private society for verified supercar owners. Membership by invitation only.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => router.push('/login')}
            accessibilityRole="button"
            accessibilityLabel="Existing member sign in"
          >
            <Text variant="caption" gold>
              EXISTING MEMBER
            </Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push('/invite')}
            accessibilityRole="button"
            accessibilityLabel="Redeem invitation"
          >
            <Text variant="caption" gold>
              REDEEM INVITATION
            </Text>
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
              <Text variant="caption" style={styles.devLabel}>
                DEV BYPASS · STARK #000001
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </CinematicBackdrop>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  actions: {
    gap: 12,
  },
  lede: {
    color: shell.muted,
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  primary: {
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  secondary: {
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
  dev: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  devLabel: {
    color: shell.muted,
    letterSpacing: 1.5,
  },
});
