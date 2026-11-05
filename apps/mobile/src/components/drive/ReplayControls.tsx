import { useRef } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Text } from '@underground/ui';
import { formatDistanceM, formatDurationMs } from '../../drive/format';
import { shell } from '../../theme/shell';

type Props = {
  playing: boolean;
  progress: number;
  distanceM: number;
  elapsedMs: number;
  totalDistanceM: number;
  totalElapsedMs: number;
  onPlayPause: () => void;
  onRestart: () => void;
  onScrub: (progress: number) => void;
};

export function ReplayControls({
  playing,
  progress,
  distanceM,
  elapsedMs,
  totalDistanceM,
  totalElapsedMs,
  onPlayPause,
  onRestart,
  onScrub,
}: Props) {
  const trackWidth = useRef(1);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = Math.max(1, e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" gold>
        REPLAY
      </Text>
      <Text variant="body">
        {formatDistanceM(distanceM)} / {formatDistanceM(totalDistanceM)} ·{' '}
        {formatDurationMs(elapsedMs)} / {formatDurationMs(totalElapsedMs)}
      </Text>
      <Pressable
        onLayout={onTrackLayout}
        onPress={e => {
          const x = e.nativeEvent.locationX;
          onScrub(Math.min(1, Math.max(0, x / trackWidth.current)));
        }}
        accessibilityRole="adjustable"
        accessibilityLabel="Scrub trip replay"
        style={styles.trackHit}
      >
        <View style={styles.trackBg}>
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </View>
      </Pressable>
      <View style={styles.buttons}>
        <Pressable
          onPress={onPlayPause}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause replay' : 'Play replay'}
          style={styles.btn}
        >
          <Text variant="caption" gold>
            {playing ? 'PAUSE' : 'PLAY'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onRestart}
          accessibilityRole="button"
          accessibilityLabel="Restart replay"
          style={styles.btn}
        >
          <Text variant="caption" gold>
            RESTART
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingVertical: 12,
  },
  trackHit: {
    paddingVertical: 8,
  },
  trackBg: {
    height: 4,
    backgroundColor: 'rgba(197,165,114,0.2)',
    overflow: 'hidden',
  },
  trackFill: {
    height: 4,
    backgroundColor: shell.accent,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.4)',
  },
});
