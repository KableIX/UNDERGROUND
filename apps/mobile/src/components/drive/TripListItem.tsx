import { Pressable, StyleSheet, View } from 'react-native';
import type { GpsSample, TripSummary } from '@underground/drive-tracking';
import { Text } from '@underground/ui';
import {
  classificationLabel,
  formatDistanceM,
  formatDurationMs,
  formatTripStart,
  gpsQualityLabel,
} from '../../drive/format';
import { shell } from '../../theme/shell';
import { MiniRouteMap } from './MiniRouteMap';

type Props = {
  trip: TripSummary;
  samples: readonly GpsSample[];
  vehicleLabel: string | null;
  onPress: () => void;
  onDelete: () => void;
};

export function TripListItem({ trip, samples, vehicleLabel, onPress, onDelete }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open trip from ${formatTripStart(trip.startedAtMs)}`}
      style={styles.row}
    >
      <MiniRouteMap points={samples} />
      <View style={styles.meta}>
        <Text variant="caption" gold>
          {formatTripStart(trip.startedAtMs).toUpperCase()}
        </Text>
        <Text variant="body">
          {formatDistanceM(trip.distanceM)} · {formatDurationMs(trip.durationMs)}
        </Text>
        <Text variant="caption" style={styles.muted}>
          {trip.startLabel ?? '—'} → {trip.finishLabel ?? '—'}
        </Text>
        <Text variant="caption" style={styles.muted}>
          {vehicleLabel ?? 'No vehicle'} · {gpsQualityLabel(trip.gpsQuality)} ·{' '}
          {classificationLabel(trip.classification)}
        </Text>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete trip and local GPS"
          hitSlop={8}
          style={styles.delete}
        >
          <Text variant="caption" style={styles.deleteText}>
            DELETE
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 12,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.18)',
  },
  meta: {
    gap: 4,
  },
  muted: {
    color: shell.muted,
  },
  delete: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  deleteText: {
    color: shell.muted,
    letterSpacing: 1.4,
  },
});
