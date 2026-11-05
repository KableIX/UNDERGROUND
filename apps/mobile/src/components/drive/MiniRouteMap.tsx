import { StyleSheet, View } from 'react-native';
import { projectToUnitSquare } from '@underground/drive-tracking';
import { shell } from '../../theme/shell';

type Point = { latitude: number; longitude: number };

type Props = {
  points: readonly Point[];
  height?: number;
};

/**
 * Offline mini route preview — projected polyline, no tiles / no road snap.
 */
export function MiniRouteMap({ points, height = 88 }: Props) {
  const projected = projectToUnitSquare(points);
  if (projected.length < 2) {
    return <View style={[styles.empty, { height }]} />;
  }

  // Approximate segments with thin Views — avoids SVG dependency.
  const segments = [];
  for (let i = 1; i < projected.length; i += 1) {
    const a = projected[i - 1]!;
    const b = projected[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push(
      <View
        key={`seg-${i}`}
        style={{
          position: 'absolute',
          left: `${a.x * 100}%`,
          top: `${a.y * 100}%`,
          width: `${len * 100}%`,
          height: 2,
          backgroundColor: shell.routeGlow,
          transform: [{ rotate: `${angle}deg` }],
          opacity: 0.9,
        }}
      />,
    );
  }

  const start = projected[0]!;
  const end = projected[projected.length - 1]!;

  return (
    <View style={[styles.frame, { height }]} accessibilityLabel="Trip route preview">
      {segments}
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
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: 0,
    backgroundColor: 'rgba(197,165,114,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.22)',
    overflow: 'hidden',
  },
  empty: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.15)',
  },
  node: {
    position: 'absolute',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: 4,
  },
  start: {
    backgroundColor: shell.accent,
  },
  finish: {
    backgroundColor: shell.text,
    borderWidth: 1,
    borderColor: shell.accent,
  },
});
