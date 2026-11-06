import { StyleSheet, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { ConquestMap } from '../../src/components/ConquestMap';

/** Explicitly opened development map, never the PLAY landing screen. */
export default function DevConquestMapScreen() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <ConquestMap initialMode="conquest" />
      <Pressable
        onPress={() => router.back()}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Return to conquest selection"
      >
        <Text variant="caption" style={styles.label}>‹ CONQUESTS</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },
  back: {
    position: 'absolute',
    top: 6,
    left: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#D0B88F',
    zIndex: 10,
  },
  label: { color: '#08090A' },
});
