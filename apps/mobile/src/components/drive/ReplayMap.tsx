import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GpsSample, ReplayCursor } from '@underground/drive-tracking';
import { projectToUnitSquare } from '@underground/drive-tracking';
import { shell } from '../../theme/shell';

type Props = {
  samples: readonly GpsSample[];
  cursor: ReplayCursor | null;
};

/**
 * Full-bleed replay plane using recorded polyline only.
 * No fabricated road snap — indicator tracks interpolated real samples.
 */
export function ReplayMap({ samples, cursor }: Props) {
  const projected = useMemo(() => projectToUnitSquare(samples), [samples]);
  const cursorProjected = useMemo(() => {
    if (!cursor || samples.length === 0) return null;
    const withCursor = projectToUnitSquare([
      ...samples,
      { latitude: cursor.latitude, longitude: cursor.longitude },
    ]);
    return withCursor[withCursor.length - 1] ?? null;
  }, [cursor, samples]);

  if (projected.length < 2) {
    return <View style={styles.empty} />;
  }

  const start = projected[0]!;
  const end = projected[projected.length - 1]!;

  return (
    <View style={styles.frame} accessibilityLabel="Trip replay map">
      {projected.slice(1).map((b, i) => {
        const a = projected[i]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`r-${i}`}
            style={{
              position: 'absolute',
              left: `${a.x * 100}%`,
              top: `${a.y * 100}%`,
              width: `${len * 100}%`,
              height: 3,
              backgroundColor: shell.routeGlow,
              transform: [{ rotate: `${angle}deg` }],
              opacity: 0.85,
            }}
          />
        );
      })}
      <View
        style={[
          styles.node,
          styles.start,
          { left: `${start.x * 100}%`, top: `${start.y * 100}%` },
        ]}
      />
      <View
        style={[
          styles.node,
          styles.finish,
          { left: `${end.x * 100}%`, top: `${end.y * 100}%` },
        ]}
      />
      {cursorProjected ? (
        <View
          style={[
            styles.cursor,
            {
              left: `${cursorProjected.x * 100}%`,
              top: `${cursorProjected.y * 100}%`,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    minHeight: 280,
    backgroundColor: shell.mapVoid,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.25)',
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    minHeight: 280,
    backgroundColor: shell.mapVoid,
  },
  node: {
    position: 'absolute',
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
  },
  start: {
    backgroundColor: shell.accent,
  },
  finish: {
    backgroundColor: shell.text,
    borderWidth: 1,
    borderColor: shell.accent,
  },
  cursor: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    marginTop: -8,
    borderRadius: 8,
    backgroundColor: shell.accent,
    borderWidth: 2,
    borderColor: shell.text,
  },
});
