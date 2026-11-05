import { Pressable } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

function AccountButton() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/(tabs)/profile')}
      accessibilityRole="button"
      accessibilityLabel="Open account profile"
      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
    >
      <Text variant="caption" gold>
        ACCOUNT
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: shell.background },
        headerTintColor: shell.accent,
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: 'Cinzel_600SemiBold',
          fontWeight: '600',
          letterSpacing: 3,
          fontSize: 14,
        },
        headerRight: () => <AccountButton />,
        tabBarStyle: {
          backgroundColor: shell.tabBar,
          borderTopColor: 'rgba(197,165,114,0.25)',
          height: 58,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: shell.accent,
        tabBarInactiveTintColor: shell.muted,
        tabBarLabelStyle: {
          fontFamily: 'DMSans_500Medium',
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        tabBarAccessibilityLabel: undefined,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'NEWSWIRE',
          headerTitle: 'UNDERGROUND',
          tabBarAccessibilityLabel: 'Newswire tab',
        }}
      />
      <Tabs.Screen
        name="conquest"
        options={{
          title: 'MAP',
          headerTitle: 'WORLD MAP',
          tabBarAccessibilityLabel: 'Full world map tab',
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'GARAGE',
          headerTitle: 'GARAGE',
          tabBarAccessibilityLabel: 'Garage tab',
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'FRIENDS',
          headerTitle: 'FRIENDS',
          tabBarAccessibilityLabel: 'Friends tab',
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'RANKINGS',
          headerTitle: 'RANKINGS',
          tabBarAccessibilityLabel: 'Rankings tab',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'PROFILE',
          headerTitle: 'PROFILE',
          headerRight: () => null,
        }}
      />
    </Tabs>
  );
}
