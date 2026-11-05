import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import { CinematicBackdrop } from '../src/components/brand/CinematicBackdrop';
import { UndergroundMark } from '../src/components/brand/UndergroundMark';
import { useSession } from '../src/session/SessionContext';
import { shell } from '../src/theme/shell';

/** Existing-member sign-in shell — fixture auth until Supabase Auth is wired. */
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, signInExistingMember } = useSession();
  const [name, setName] = useState('STARK');
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <CinematicBackdrop>
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text variant="caption" gold>
            BACK
          </Text>
        </Pressable>
        <UndergroundMark size="compact" showWordmark />
        <Text variant="title" gold style={styles.title}>
          Existing member
        </Text>
        <Text style={styles.body}>
          Enter your display name. Live credentials arrive with Supabase Auth — this path is a
          fixture shell for UX review.
        </Text>
        <Text variant="caption" gold style={styles.label}>
          DISPLAY NAME
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholderTextColor={shell.muted}
          style={styles.input}
          accessibilityLabel="Display name"
        />
        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          style={styles.cta}
          onPress={() => {
            const result = signInExistingMember(name);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.replace('/(tabs)');
          }}
          accessibilityRole="button"
        >
          <Text variant="caption" gold>
            ENTER
          </Text>
        </Pressable>
      </View>
    </CinematicBackdrop>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    marginTop: 28,
  },
  body: {
    color: shell.muted,
    lineHeight: 22,
  },
  label: {
    marginTop: 12,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: shell.text,
    letterSpacing: 2,
  },
  cta: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  error: {
    color: '#B33A3A',
  },
});
