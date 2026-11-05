import { Redirect } from 'expo-router';
import { useSession } from '../src/session/SessionContext';

/** Boot route — send members to tabs, everyone else to cinematic entrance. */
export default function Index() {
  const { state } = useSession();
  if (state.status === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href="/welcome" />;
}
