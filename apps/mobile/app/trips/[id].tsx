import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  buildReplayTimeline,
  scrubReplay,
  type GpsSample,
  type ReplayCursor,
  type TripSummary,
} from '@underground/drive-tracking';
import { Screen, Text } from '@underground/ui';
import { ReplayControls } from '../../src/components/drive/ReplayControls';
import { ReplayMap } from '../../src/components/drive/ReplayMap';
import {
  classificationLabel,
  formatDistanceM,
  formatDurationMs,
  formatTripStart,
  gpsQualityLabel,
} from '../../src/drive/format';
import { getTripStore } from '../../src/drive/trip-store';
import { vehicleLabelForId } from '../../src/drive/vehicle-label';
import { shell } from '../../src/theme/shell';

export default function TripReplayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [samples, setSamples] = useState<GpsSample[]>([]);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const raf = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!id) return;
      const state = await getTripStore().getSession(id);
      if (cancelled) return;
      if (!state?.session.startedAtMs) {
        setLoading(false);
        return;
      }
      setSamples(state.samples);
      setSummary({
        id: state.session.id,
        startedAtMs: state.session.startedAtMs,
        endedAtMs: state.session.endedAtMs,
        distanceM: state.session.distanceM,
        durationMs: state.session.activeDurationMs,
        startLabel: state.session.startLabel,
        finishLabel: state.session.finishLabel,
        vehicleId: state.session.vehicleId,
        gpsQuality: state.session.gpsQuality,
        classification: state.session.classification,
        sampleCount: state.samples.length,
        status: state.session.status,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const timeline = useMemo(() => buildReplayTimeline(samples), [samples]);
  const cursor: ReplayCursor | null = useMemo(
    () => scrubReplay(timeline, progress),
    [timeline, progress],
  );

  useEffect(() => {
    if (!playing) {
      if (raf.current) clearInterval(raf.current);
      raf.current = null;
      return;
    }
    raf.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + 0.01;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
    }, 50);
    return () => {
      if (raf.current) clearInterval(raf.current);
    };
  }, [playing]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={shell.accent} />
      </Screen>
    );
  }

  if (!summary) {
    return (
      <Screen>
        <Text variant="body">Trip not found on this device.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.stack}>
        <Text variant="caption" gold>
          {formatTripStart(summary.startedAtMs).toUpperCase()}
        </Text>
        <Text variant="body">
          {formatDistanceM(summary.distanceM)} · {formatDurationMs(summary.durationMs)}
        </Text>
        <Text variant="caption" style={styles.muted}>
          {summary.startLabel ?? '—'} → {summary.finishLabel ?? '—'}
        </Text>
        <Text variant="caption" style={styles.muted}>
          {vehicleLabelForId(summary.vehicleId) ?? 'No vehicle'} ·{' '}
          {gpsQualityLabel(summary.gpsQuality)} · {classificationLabel(summary.classification)}
        </Text>
        <ReplayMap samples={samples} cursor={cursor} />
        <ReplayControls
          playing={playing}
          progress={progress}
          distanceM={cursor?.distanceM ?? 0}
          elapsedMs={cursor?.elapsedMs ?? 0}
          totalDistanceM={timeline.totalDistanceM}
          totalElapsedMs={timeline.totalElapsedMs}
          onPlayPause={() => setPlaying(p => !p)}
          onRestart={() => {
            setPlaying(false);
            setProgress(0);
          }}
          onScrub={p => {
            setPlaying(false);
            setProgress(p);
          }}
        />
        <Text variant="caption" style={styles.muted}>
          Replay uses recorded GPS only — no road snapping without a routing provider. Local trip
          {summary.classification === 'verified_capture' ? ' · server-verified capture' : ''}.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    gap: 10,
  },
  muted: {
    color: shell.muted,
  },
});
