import { Pressable, View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

function HeaderActions() {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => router.push('/newswire')}
        accessibilityRole="button"
        accessibilityLabel="Open Newswire activity"
        style={{ paddingHorizontal: 10, paddingVertical: 8 }}
      >
        <Text variant="caption" gold>NEWS</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/(tabs)/profile')}
        accessibilityRole="button"
        accessibilityLabel="Open member profile"
        style={{ paddingHorizontal: 10, paddingVertical: 8 }}
      >
        <Text variant="caption" gold>PROFILE</Text>
      </Pressable>
    </View>
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
        headerRight: () => <HeaderActions />,
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
          title: 'MAP',
          headerTitle: 'WORLD MAP',
          tabBarAccessibilityLabel: 'Map: explore every road',
        }}
      />
      <Tabs.Screen
        name="conquest"
        options={{
          title: 'PLAY',
          headerShown: false,
          tabBarAccessibilityLabel: 'Play: capture territories',
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: 'MY GARAGE',
          headerTitle: 'MY GARAGE',
          tabBarAccessibilityLabel: 'My Garage: open your garage',
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
