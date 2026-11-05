import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text } from '@underground/ui';
import { formatDistanceM, formatDurationMs, gpsQualityLabel } from '../../src/drive/format';
import { usePersistentDrive } from '../../src/drive/use-persistent-drive';
import { localSeedVehicleId } from '../../src/drive/vehicle-label';
import { shell } from '../../src/theme/shell';

/**
 * Standalone foreground recorder with SQLite persistence.
 * Not connected to Conquest ownership / CLOUT.
 */
export default function RecordDriveScreen() {
  const router = useRouter();
  const drive = usePersistentDrive();
  const status = drive.state.session.status;
  const vehicleId = localSeedVehicleId();
  const privateKph =
    drive.privateSpeedMps != null ? Math.round(drive.privateSpeedMps * 3.6) : null;

  return (
    <Screen>
      <View style={styles.stack}>
        <Text variant="caption" gold>
          FOREGROUND ONLY · PRIVATE
        </Text>
        <Text variant="title">
          {status === 'recording'
            ? 'Recording'
            : status === 'paused' || status === 'interrupted'
              ? 'Paused'
              : status === 'ended'
                ? 'Saved'
                : status === 'permission_denied'
                  ? 'Location permission needed'
                  : 'Ready'}
        </Text>
        <Text variant="body" style={styles.muted}>
          Distance {formatDistanceM(drive.summary?.distanceM ?? 0)} · Duration{' '}
          {formatDurationMs(drive.summary?.durationMs ?? 0)}
        </Text>
        <Text variant="caption" style={styles.muted}>
          {gpsQualityLabel(drive.state.session.gpsQuality)} · Samples {drive.state.samples.length}
          {privateKph != null ? ` · ${privateKph} km/h (private)` : ''}
        </Text>
        {drive.recovering ? (
          <Text variant="caption" style={styles.muted}>
            Checking for interrupted session…
          </Text>
        ) : null}
        {(status === 'interrupted' || status === 'paused') && (
          <Text variant="body" style={styles.muted}>
            Interrupted session recoverable. Resume or end to save.
          </Text>
        )}
        <View style={styles.actions}>
          {(status === 'idle' ||
            status === 'ended' ||
            status === 'permission_denied' ||
            status === 'unavailable') && (
            <Pressable
              onPress={() => void drive.start({ vehicleId })}
              style={styles.btn}
              accessibilityRole="button"
              accessibilityLabel="Start drive recording"
            >
              <Text variant="caption" gold>
                START
              </Text>
            </Pressable>
          )}
          {status === 'recording' && (
            <Pressable
              onPress={() => void drive.pause()}
              style={styles.btn}
              accessibilityRole="button"
              accessibilityLabel="Pause drive recording"
            >
              <Text variant="caption" gold>
                PAUSE
              </Text>
            </Pressable>
          )}
          {(status === 'paused' || status === 'interrupted') && (
            <Pressable
              onPress={() => void drive.resume()}
              style={styles.btn}
              accessibilityRole="button"
              accessibilityLabel="Resume drive recording"
            >
              <Text variant="caption" gold>
                RESUME
              </Text>
            </Pressable>
          )}
          {(status === 'recording' || status === 'paused' || status === 'interrupted') && (
            <Pressable
              onPress={() => {
                void (async () => {
                  await drive.end();
                  router.replace('/trips');
                })();
              }}
              style={styles.btn}
              accessibilityRole="button"
              accessibilityLabel="End and save drive"
            >
              <Text variant="caption" gold>
                END & SAVE
              </Text>
            </Pressable>
          )}
          {status === 'ended' && (
            <Pressable
              onPress={() => router.replace('/trips')}
              style={styles.btn}
              accessibilityRole="button"
              accessibilityLabel="Back to trip history"
            >
              <Text variant="caption" gold>
                HISTORY
              </Text>
            </Pressable>
          )}
        </View>
        <Text variant="caption" style={styles.footnote}>
          Background GPS is not enabled in this build. Recording pauses when the app leaves the
          foreground. No fabricated samples. No ownership or CLOUT from this screen.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    flex: 1,
  },
  muted: {
    color: shell.muted,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.45)',
  },
  footnote: {
    marginTop: 'auto',
    color: shell.muted,
    lineHeight: 18,
  },
});
