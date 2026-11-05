import { useMemo, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '@underground/ui';
import type { TerritoryDefinition } from '@underground/domain';
import { boundsFromLineStrings, projectLine, type LonLat } from '../lib/geo-project';
import { buildMapboxSatelliteUrl } from '../lib/mapbox-static';
import { publicEnv, mapboxConfigured } from '../lib/env';
import { shell } from '../theme/shell';

type Camera = { longitude: number; latitude: number; zoom: number };

type Props = {
  territories: TerritoryDefinition[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  badge: string;
  disclaimer: string;
  camera: Camera;
  illuminated?: boolean;
};

/**
 * Dark tactical map plane: Mapbox satellite when token present, otherwise
 * a near-black geometric fallback. Routes are projected LineStrings with
 * selectable illuminated strokes — no native Mapbox SDK required yet.
 */
export function TacticalMapPlane({
  territories,
  selectedSlug,
  onSelect,
  badge,
  disclaimer,
  camera,
  illuminated = true,
}: Props) {
  const [size, setSize] = useState({ width: 360, height: 280 });

  const lines = useMemo(
    () =>
      territories.map((t) => ({
        slug: t.slug,
        name: t.name,
        coords: t.geometry.coordinates as LonLat[],
      })),
    [territories],
  );

  const bounds = useMemo(
    () => boundsFromLineStrings(lines.map((l) => l.coords)),
    [lines],
  );

  const projected = useMemo(
    () =>
      lines.map((line) => ({
        ...line,
        points: projectLine(line.coords, bounds, size.width, size.height),
      })),
    [lines, bounds, size.width, size.height],
  );

  const satelliteUrl = useMemo(
    () =>
      buildMapboxSatelliteUrl({
        env: publicEnv,
        longitude: camera.longitude,
        latitude: camera.latitude,
        zoom: camera.zoom,
        width: size.width,
        height: size.height,
      }),
    [camera, size.width, size.height],
  );

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setSize({ width, height });
    }
  }

  return (
    <View style={styles.root} onLayout={onLayout}>
      {satelliteUrl ? (
        <Image source={{ uri: satelliteUrl }} style={styles.satellite} resizeMode="cover" />
      ) : (
        <View style={styles.fallback}>
          <View style={styles.gridH} />
          <View style={styles.gridV} />
          <View style={[styles.gridH, { top: '33%' }]} />
          <View style={[styles.gridH, { top: '66%' }]} />
          <View style={[styles.gridV, { left: '33%' }]} />
          <View style={[styles.gridV, { left: '66%' }]} />
        </View>
      )}
      <View style={styles.tacticalWash} />

      <Text variant="caption" gold style={styles.badge}>
        {badge}
        {mapboxConfigured ? ' · MAPBOX SAT' : ' · DARK FALLBACK'}
      </Text>

      {projected.map((route) => {
        const active = route.slug === selectedSlug;
        const mid = route.points[Math.floor(route.points.length / 2)];
        return (
          <View key={route.slug} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            <RoutePolyline
              points={route.points}
              active={active}
              illuminated={illuminated}
            />
            {route.points[0] ? (
              <View
                pointerEvents="none"
                style={[
                  styles.node,
                  {
                    left: route.points[0].x - (active ? 5 : 4),
                    top: route.points[0].y - (active ? 5 : 4),
                  },
                  active && styles.nodeActive,
                ]}
              />
            ) : null}
            {mid ? (
              <Pressable
                onPress={() => onSelect(route.slug)}
                accessibilityRole="button"
                accessibilityLabel={`Select ${route.name}`}
                style={[
                  styles.hit,
                  {
                    left: Math.max(0, mid.x - 12),
                    top: Math.max(0, mid.y - 18),
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={[styles.label, { opacity: active ? 1 : 0.65 }]}
                >
                  {route.name.toUpperCase()}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <Text variant="caption" style={styles.disclaimer}>
        {disclaimer}
      </Text>
    </View>
  );
}

function RoutePolyline({
  points,
  active,
  illuminated,
}: {
  points: { x: number; y: number }[];
  active: boolean;
  illuminated: boolean;
}) {
  if (points.length < 2) return null;
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    segments.push(
      <View
        key={`${i}-${a.x}-${a.y}`}
        style={[
          styles.segment,
          illuminated && styles.segmentGlow,
          active && styles.segmentActive,
          {
            width: length,
            left: a.x,
            top: a.y,
            transform: [{ rotate: `${angle}deg` }],
          },
        ]}
      />,
    );
  }
  return <>{segments}</>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: shell.mapVoid,
    overflow: 'hidden',
  },
  satellite: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.72,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#061018',
  },
  gridH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(111,168,201,0.18)',
  },
  gridV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(111,168,201,0.18)',
  },
  tacticalWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,7,12,0.45)',
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 4,
  },
  disclaimer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    color: shell.muted,
    zIndex: 4,
  },
  segment: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#6FA8C9',
    opacity: 0.55,
    transformOrigin: 'left center',
  },
  segmentGlow: {
    shadowColor: '#8EC8E8',
    shadowOpacity: 0.85,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  segmentActive: {
    height: 3,
    opacity: 1,
    backgroundColor: shell.accent,
    shadowColor: shell.routeGlow,
  },
  node: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: shell.nodeGlow,
    zIndex: 3,
  },
  nodeActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: shell.accent,
  },
  hit: {
    position: 'absolute',
    zIndex: 5,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  label: {
    color: shell.muted,
    maxWidth: 160,
  },
});
