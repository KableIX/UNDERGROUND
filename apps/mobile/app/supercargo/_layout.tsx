import { Stack } from 'expo-router';

export default function SupercargoLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#08090A' } }} />;
}
