import { Stack } from 'expo-router';
import { shell } from '../../src/theme/shell';

/** Messages: direct messages and club chat. Sign-in required; the screens check it themselves. */
export default function MessagesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: shell.background },
        headerTintColor: shell.accent,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: 'Cinzel_600SemiBold', fontWeight: '600', fontSize: 14 },
        contentStyle: { backgroundColor: shell.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'MESSAGES' }} />
      <Stack.Screen name="[threadId]" options={{ title: '' }} />
    </Stack>
  );
}
