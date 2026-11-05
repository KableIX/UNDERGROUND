import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Cinzel_600SemiBold } from '@expo-google-fonts/cinzel';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { SessionProvider, useSession } from '../src/session/SessionContext';
import { shell } from '../src/theme/shell';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { state } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const root = segments[0];
    const inAuth =
      root === 'welcome' || root === 'login' || root === 'invite' || root === 'index' || !root;
    if (state.status === 'anonymous' && !inAuth) {
      router.replace('/welcome');
      return;
    }
    if (state.status === 'authenticated' && (root === 'welcome' || root === 'login' || root === 'invite' || root === 'index')) {
      router.replace('/(tabs)');
    }
  }, [state.status, segments, router]);

  return <>{children}</>;
}

function RootNavigator() {
  const [fontsLoaded] = useFonts({
    Cinzel_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: shell.mapVoid, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={shell.accent} />
      </View>
    );
  }

  return (
    <AuthGate>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: shell.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="invite" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <RootNavigator />
    </SessionProvider>
  );
}
