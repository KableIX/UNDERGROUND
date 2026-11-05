import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { shell } from '../src/theme/shell';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: shell.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
