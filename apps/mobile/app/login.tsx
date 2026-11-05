import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@underground/ui';
import { CinematicBackdrop } from '../src/components/brand/CinematicBackdrop';
import { UndergroundMark } from '../src/components/brand/UndergroundMark';
import { useSession } from '../src/session/SessionContext';
import { shell } from '../src/theme/shell';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, signInWithEmail, signInExistingMember, liveAuthConfigured, canDevBypass } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fixtureName, setFixtureName] = useState('STARK');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status === 'authenticated') return <Redirect href="/(tabs)" />;

  async function submit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = liveAuthConfigured
        ? await signInWithEmail(email, password)
        : canDevBypass ? signInExistingMember(fixtureName)
        : { ok: false as const, error: 'authentication_not_configured' };
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CinematicBackdrop>
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text variant="caption" gold>BACK</Text>
        </Pressable>
        <UndergroundMark size="compact" showWordmark />
        <Text variant="title" gold style={styles.title}>Existing member</Text>
        <Text style={styles.body}>
          {liveAuthConfigured
            ? 'Sign in to your verified UNDERGROUND membership.'
            : canDevBypass
              ? 'Development fixture only. Live account sign-in is not configured.'
              : 'Member authentication is not available until the secure backend is configured.'}
        </Text>

        {liveAuthConfigured ? (
          <>
            <Text variant="caption" gold style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              value={email} onChangeText={setEmail} keyboardType="email-address"
              autoComplete="email" autoCapitalize="none" autoCorrect={false}
              placeholder="member@example.com" placeholderTextColor={shell.muted}
              style={styles.input} accessibilityLabel="Email address"
            />
            <Text variant="caption" gold style={styles.label}>PASSWORD</Text>
            <TextInput
              value={password} onChangeText={setPassword} secureTextEntry
              autoCapitalize="none" autoCorrect={false}
              autoComplete="password" placeholder="Password"
              placeholderTextColor={shell.muted} style={styles.input}
              accessibilityLabel="Password"
            />
          </>
        ) : canDevBypass ? (
          <>
            <Text variant="caption" gold style={styles.label}>DEV DISPLAY NAME</Text>
            <TextInput
              value={fixtureName} onChangeText={setFixtureName} autoCapitalize="characters"
              autoCorrect={false} placeholderTextColor={shell.muted}
              style={styles.input} accessibilityLabel="Development display name"
            />
          </>
        ) : null}

        {error ? <Text variant="caption" style={styles.error}>{error}</Text> : null}
        <Pressable
          disabled={busy || (!liveAuthConfigured && !canDevBypass)}
          style={[styles.cta, (busy || (!liveAuthConfigured && !canDevBypass)) && styles.disabled]}
          onPress={() => void submit()} accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={shell.accent} /> : <Text variant="caption" gold>ENTER</Text>}
        </Pressable>
      </View>
    </CinematicBackdrop>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, gap: 12 },
  title: { marginTop: 28 },
  body: { color: shell.muted, lineHeight: 22 },
  label: { marginTop: 12 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    paddingHorizontal: 14, paddingVertical: 14,
    color: shell.text,
  },
  cta: {
    marginTop: 16, paddingVertical: 16,
    alignItems: 'center', borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  disabled: { opacity: 0.4 },
  error: { color: '#D66D6D' },
});
