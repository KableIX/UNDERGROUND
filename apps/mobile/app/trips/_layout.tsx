import { Stack } from 'expo-router';
import { shell } from '../../src/theme/shell';

/**
 * Standalone Trip History stack — not wired into Conquest map UI.
 * See docs/TRIP_HISTORY_NAV_INTEGRATION.md for optional tab/profile entry points.
 */
export default function TripsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: shell.background },
        headerTintColor: shell.accent,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Cinzel_600SemiBold',
          fontWeight: '600',
          fontSize: 14,
        },
        contentStyle: { backgroundColor: shell.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'TRIP HISTORY' }} />
      <Stack.Screen name="record" options={{ title: 'RECORD DRIVE' }} />
      <Stack.Screen name="[id]" options={{ title: 'TRIP' }} />
    </Stack>
  );
}
