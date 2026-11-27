import {goldTouch} from '../../src/components/GoldTouch';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
        style={({pressed})=>[{paddingHorizontal:10,paddingVertical:8,borderRadius:20},pressed && goldTouch]}
      >
        <Text variant="caption" gold>NEWS</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/(tabs)/profile')}
        accessibilityRole="button"
        accessibilityLabel="Open my profile"
        style={({pressed})=>[{paddingHorizontal:10,paddingVertical:8,borderRadius:20},pressed && goldTouch]}
      >
        <Text variant="caption" gold>MY PROFILE</Text>
      </Pressable>
    </View>
  );
}

const tabIcons = {
  index: 'map-marker',
  conquest: 'steering',
  supercargo: 'radar',
  garage: 'garage-variant',
  friends: 'account-group',
  rankings: 'trophy-outline',
} as const;

export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, focused }) => {
          const name = tabIcons[route.name as keyof typeof tabIcons];
          return name ? <MaterialCommunityIcons name={name} size={25} color={color}
            style={focused ? { textShadowColor: '#C5A572', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 } : undefined} /> : null;
        },
        tabBarButton: ({style,children,onPress,onLongPress,accessibilityLabel,accessibilityState,testID,disabled}) => (
          <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={accessibilityState}
            testID={testID} disabled={disabled ?? false} onPress={onPress} onLongPress={onLongPress}
            style={({pressed})=>[style,{borderRadius:22,borderWidth:1,borderColor:'transparent'},(pressed||accessibilityState?.selected)&&goldTouch]}>
            {children}
          </Pressable>
        ),
        tabBarLabelPosition: 'below-icon',
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
          height: 56 + bottom,
          paddingBottom: Math.max(4, bottom),
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#F0D49C',
        tabBarInactiveTintColor: '#ADB7BE',
        tabBarLabelStyle: {
          fontFamily: 'BarlowCondensed_700Bold',
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        tabBarAccessibilityLabel: undefined,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'MAP',
          headerShown: false,
          tabBarAccessibilityLabel: 'Map: explore every road',
        }}
      />
      <Tabs.Screen
        name="conquest"
        options={{
          title: 'DRIVE',
          headerShown: false,
          tabBarAccessibilityLabel: 'Drive: regions, conquests and club drives',
        }}
      />
      <Tabs.Screen
        name="supercargo"
        options={{
          title: 'SUPERCARGO',
          headerShown: false,
          tabBarAccessibilityLabel: 'SupercarGO: sightings, the Ledger and the Exchange',
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