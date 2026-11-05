import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { shell } from '../src/theme/shell';
import { useSession } from '../src/session/SessionContext';

/** Boot route — send members to tabs, everyone else to cinematic entrance. */
export default function Index() {
  const { state } = useSession();
  if (state.status === 'loading') {
    return <View style={{ flex: 1, backgroundColor: shell.mapVoid, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={shell.accent} />
    </View>;
  }
  if (state.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/welcome" />;
}
