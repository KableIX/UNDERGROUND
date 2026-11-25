import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@underground/ui';
import { useRadar } from './RadarContext';

export function RadarMapStatus() {
  const radar = useRadar();
  const router = useRouter();
  const latest = radar.healthy ? radar.snapshot?.alerts[0] : null;
  const status = latest
    ? `${latest.band} · ${latest.direction} · ${latest.strength}/8`
    : radar.model && !radar.healthy
      ? 'Detector feed stale'
      : radar.healthy && radar.snapshot?.recognized === false
        ? 'Detector data unknown'
        : radar.feedStatus === 'unavailable'
          ? 'Club feed unavailable'
          : radar.nearby.length
            ? `${radar.nearby.length} recent club reports nearby`
            : radar.active
              ? 'Radar session active'
              : 'Connect detector / club reports';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Club radar. ${status}`}
      onPress={() => router.push('/radar')}
      style={styles.button}
    >
      <Text variant="caption" gold>
        RADAR · {status}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
});
