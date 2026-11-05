import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import { CinematicBackdrop } from '../src/components/brand/CinematicBackdrop';
import { UndergroundMark } from '../src/components/brand/UndergroundMark';
import { useSession } from '../src/session/SessionContext';
import { shell } from '../src/theme/shell';

/** Invitation redemption — fixture code only in non-production. */
export default function InviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, redeemInvite } = useSession();
  const [code, setCode] = useState('');
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
          Redeem invitation
        </Text>
        <Text style={styles.body}>
          Invitation-only gate. Production redemption requires hashed invite codes via API — this
          screen accepts the documented preview fixture only.
        </Text>
        <Text variant="caption" gold style={styles.label}>
          INVITATION CODE
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="UNDERGROUND-…"
          placeholderTextColor={shell.muted}
          style={styles.input}
          accessibilityLabel="Invitation code"
        />
        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Pressable
          style={styles.cta}
          onPress={() => {
            const result = redeemInvite(code);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.replace('/(tabs)');
          }}
          accessibilityRole="button"
        >
          <Text variant="caption" gold>
            REDEEM
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
    letterSpacing: 1.5,
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
