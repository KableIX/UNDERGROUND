import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TerritoryDefinition } from '@underground/domain';
import { Text } from '@underground/ui';
import { shell } from '../../theme/shell';
import { TacticalMapPlane } from '../TacticalMapPlane';

type Camera = { longitude: number; latitude: number; zoom: number };
type Props = {
  territories: TerritoryDefinition[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  camera: Camera;
  badge: string;
  showTerritories: boolean;
  followUser: boolean;
  showUserLocation: boolean;
  cameraRevision: number;
};

type MapsModule = {
  default: ComponentType<Record<string, unknown>>;
  Polyline: ComponentType<Record<string, unknown>>;
  Marker: ComponentType<Record<string, unknown>>;
  PROVIDER_DEFAULT?: string;
};

/** Apple MapKit basemap when Mapbox is not configured; real roads, world-wide pan/zoom.
 * No territory limits are applied to the map viewport.
 * A legacy tactical fallback is retained for older installed native binaries.
 */
export function WorldMapFallback({
  territories, selectedSlug, onSelect, camera, badge, showTerritories, followUser,
  showUserLocation, cameraRevision,
}: Props) {
  const [maps, setMaps] = useState<MapsModule | null>(null);
  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-maps');
      if (mod?.default && mod?.Polyline) setMaps(mod as MapsModule);
    } catch {
      setMaps(null);
    }
  }, []);

  const region = useMemo(() => {
    const delta = Math.max(0.005, Math.min(100, 30 / (2 ** (camera.zoom - 3))));
    return {
      latitude: camera.latitude,
      longitude: camera.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
  }, [camera.latitude, camera.longitude, camera.zoom]);

  if (!maps) {
    return <TacticalMapPlane
      territories={showTerritories ? territories : []}
      selectedSlug={selectedSlug}
      onSelect={onSelect}
      camera={camera}
      illuminated
      badge={badge}
      disclaimer="MAP SDK NOT INSTALLED IN THIS DEV CLIENT · NEW IOS BUILD REQUIRED"
    />;
  }

  const MapView = maps.default;
  const Polyline = maps.Polyline;
  const Marker = maps.Marker;
  return (
    <View style={styles.root}>
      <MapView
        key={`map-location-focus-${cameraRevision}`}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation={showUserLocation}
        followsUserLocation={followUser}
        showsMyLocationButton={false}
        showsCompass
        mapType="standard"
        rotateEnabled
        pitchEnabled
        scrollEnabled
        zoomEnabled
        accessibilityLabel="UNDERGROUND full geographic road map"
      >
        {showTerritories ? territories.map(t => (
          <Polyline
            key={t.slug}
            coordinates={t.geometry.coordinates.map(([lng, lat]) => ({
              latitude: lat,
              longitude: lng,
            }))}
            strokeColor={t.slug === selectedSlug ? shell.accent : 'rgba(197,165,114,0.60)'}
            strokeWidth={t.slug === selectedSlug ? 5 : 2}
            tappable
            onPress={() => onSelect(t.slug)}
          />
        )) : null}
        {showTerritories ? territories.map(t => {
          const first = t.geometry.coordinates[0];
          if (!first) return null;
          return (
            <Marker
              key={`marker-${t.slug}`}
              coordinate={{ longitude: first[0], latitude: first[1] }}
              title={t.name}
              description="Unverified draft route"
              onPress={() => onSelect(t.slug)}
              pinColor={shell.accent}
            />
          );
        }) : null}
      </MapView>
      <View pointerEvents="none" style={styles.badge}>
        <Text variant="caption" gold>{badge} · FULL MAP</Text>
      </View>
      {showTerritories ? (
        <View pointerEvents="none" style={styles.draft}>
          <Text variant="caption" style={styles.draftText}>
            DRAFT ROUTES · NOT ROAD-SNAPPED · NO PRODUCTION CAPTURES
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.mapVoid },
  badge: {
    position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: 'rgba(5,7,12,0.80)',
  },
  draft: {
    position: 'absolute', bottom: 12, left: 12, right: 12, padding: 8,
    backgroundColor: 'rgba(5,7,12,0.82)',
  },
  draftText: { color: shell.muted, textAlign: 'center' },
});
