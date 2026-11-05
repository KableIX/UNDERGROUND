import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { GpsSample, TripSummary } from '@underground/drive-tracking';
import { Screen, Text } from '@underground/ui';
import { TripListItem } from '../../src/components/drive/TripListItem';
import { getTripStore } from '../../src/drive/trip-store';
import { vehicleLabelForId } from '../../src/drive/vehicle-label';
import { shell } from '../../src/theme/shell';

type Row = {
  trip: TripSummary;
  samples: GpsSample[];
};

/**
 * Offline-accessible trip history. Private local trips only.
 * Territory conquest / ownership is intentionally separate.
 */
export default function TripHistoryScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const store = getTripStore();
      const summaries = await store.listTripSummaries();
      const ended = summaries.filter(t => t.status === 'ended' || t.endedAtMs != null);
      const next: Row[] = [];
      for (const trip of ended) {
        const state = await store.getSession(trip.id);
        next.push({ trip, samples: state?.samples ?? [] });
      }
      setRows(next);
    } catch {
      // Native SQLite missing / open failure — show empty history, never crash.
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onDelete = (tripId: string) => {
    Alert.alert(
      'Delete trip?',
      'Removes this trip and its local GPS samples from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await getTripStore().deleteTrip(tripId);
              await load();
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="body" style={styles.blurb}>
          Private drives stored on this device. Ordinary trips never change territory ownership or
          CLOUT.
        </Text>
        <Pressable
          onPress={() => router.push('/trips/record')}
          accessibilityRole="button"
          accessibilityLabel="Start recording a drive"
          style={styles.cta}
        >
          <Text variant="caption" gold>
            RECORD DRIVE
          </Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={shell.accent} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.trip.id}
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : undefined}
          ListEmptyComponent={
            <Text variant="body" style={styles.empty}>
              No saved trips yet. Record a foreground drive to build history offline.
            </Text>
          }
          renderItem={({ item }) => (
            <TripListItem
              trip={item.trip}
              samples={item.samples}
              vehicleLabel={vehicleLabelForId(item.trip.vehicleId)}
              onPress={() => router.push(`/trips/${item.trip.id}`)}
              onDelete={() => onDelete(item.trip.id)}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 12,
    marginBottom: 8,
  },
  blurb: {
    color: shell.muted,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.45)',
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    color: shell.muted,
    textAlign: 'center',
  },
});
