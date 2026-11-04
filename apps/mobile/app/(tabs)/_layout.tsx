import { Tabs } from 'expo-router';
import { shell } from '../../src/theme/shell';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: shell.background },
        headerTintColor: shell.accent,
        headerTitleStyle: {
          fontWeight: '600',
          letterSpacing: 3,
        },
        tabBarStyle: {
          backgroundColor: shell.tabBar,
          borderTopColor: 'rgba(197,165,114,0.25)',
        },
        tabBarActiveTintColor: shell.accent,
        tabBarInactiveTintColor: shell.muted,
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'NEWSWIRE', headerTitle: 'UNDERGROUND' }} />
      <Tabs.Screen name="conquest" options={{ title: 'CONQUEST', headerTitle: 'CONQUEST' }} />
      <Tabs.Screen name="garage" options={{ title: 'GARAGE', headerTitle: 'GARAGE' }} />
      <Tabs.Screen name="friends" options={{ title: 'FRIENDS', headerTitle: 'FRIENDS' }} />
      <Tabs.Screen name="profile" options={{ title: 'PROFILE', headerTitle: 'PROFILE' }} />
    </Tabs>
  );
}
