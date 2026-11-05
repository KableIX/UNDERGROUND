import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { TerritoryDefinition } from '@underground/domain';
import { Text } from '@underground/ui';
import { publicEnv } from '../../lib/env';
import {
  probeNativeMapbox,
  setMapboxAccessTokenSafe,
} from '../../lib/mapbox-native';
import {
  startFinishForTerritory,
  territoriesToFeatureCollection,
} from '../../lib/territory-geojson';
import { shell } from '../../theme/shell';
import { WorldMapFallback } from './WorldMapFallback';

type Camera = { longitude: number; latitude: number; zoom: number };

type Props = {
  territories: TerritoryDefinition[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  camera: Camera;
  badge: string;
  forceFallback?: boolean;
  showTerritories?: boolean;
  followUser?: boolean;
  showUserLocation?: boolean;
  cameraRevision?: number;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; kind: 'native' }
  | { status: 'fallback'; reason: string }
  | { status: 'error'; message: string };

type MapboxMod = {
  MapView: ComponentType<Record<string, unknown>>;
  Camera: ComponentType<Record<string, unknown>>;
  ShapeSource: ComponentType<Record<string, unknown>>;
  LineLayer: ComponentType<Record<string, unknown>>;
  CircleLayer: ComponentType<Record<string, unknown>>;
  UserLocation?: ComponentType<Record<string, unknown>>;
  StyleURL?: Record<string, string>;
};

/**
 * Native Mapbox territory map with graceful tactical fallback.
 * Requires custom Expo dev client — Expo Go unsupported.
 * Device rendering is unverified in this Linux agent environment.
 */
export function MapboxTerritoryMap({
  territories,
  selectedSlug,
  onSelect,
  camera,
  badge,
  forceFallback,
  showTerritories = true,
  followUser = false,
  showUserLocation = false,
  cameraRevision = 0,
}: Props) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [MapboxMod, setMapboxMod] = useState<MapboxMod | null>(null);

  useEffect(() => {
    const availability = probeNativeMapbox({ forceFallback });
    if (!availability.ok) {
      setLoad({ status: 'fallback', reason: availability.reason });
      return;
    }

    const token = publicEnv.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ?? '';
    const tokenResult = setMapboxAccessTokenSafe(token);
    if (!tokenResult.ok) {
      setLoad({
        status: 'fallback',
        reason: tokenResult.error ?? 'token_set_failed',
      });
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@rnmapbox/maps');
      const api = mod.default ?? mod;
      setMapboxMod({
        MapView: api.MapView,
        Camera: api.Camera,
        ShapeSource: api.ShapeSource,
        LineLayer: api.LineLayer,
        CircleLayer: api.CircleLayer,
        UserLocation: api.UserLocation,
        StyleURL: api.StyleURL,
      });
      setLoad({ status: 'ready', kind: 'native' });
    } catch (error) {
      setLoad({
        status: 'error',
        message: error instanceof Error ? error.message : 'mapbox_load_failed',
      });
    }
  }, [forceFallback]);

  const collection = useMemo(
    () => territoriesToFeatureCollection(territories, selectedSlug),
    [territories, selectedSlug],
  );

  const selected = territories.find((t) => t.slug === selectedSlug) ?? null;
  const endpoints = selected ? startFinishForTerritory(selected) : null;

  if (load.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={shell.accent} />
        <Text variant="caption" style={styles.muted}>
          Loading map…
        </Text>
      </View>
    );
  }

  if (load.status === 'error') {
    // Do not wrap the fallback in center-aligned content: that can collapse
    // the native map width to zero and leave the user with a blank screen.
    return (
      <WorldMapFallback
        territories={territories}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        camera={camera}
        badge={`${badge} · APPLE MAP FALLBACK`}
        showTerritories={showTerritories}
        followUser={followUser}
        showUserLocation={showUserLocation}
        cameraRevision={cameraRevision}
      />
    );
  }

  if (load.status === 'fallback' || !MapboxMod) {
    return (
      <WorldMapFallback
        territories={territories}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        camera={camera}
        badge={badge}
        showTerritories={showTerritories}
        followUser={followUser}
        showUserLocation={showUserLocation}
        cameraRevision={cameraRevision}
      />
    );
  }

  const { MapView, Camera, ShapeSource, LineLayer, CircleLayer, UserLocation, StyleURL } = MapboxMod;
  const styleURL = StyleURL?.SatelliteStreet ?? StyleURL?.Satellite ?? 'mapbox://styles/mapbox/satellite-streets-v12';

  return (
    <View style={styles.fill}>
      <MapView
        style={styles.fill}
        styleURL={styleURL}
        logoEnabled={false}
        attributionEnabled
        compassEnabled
        scaleBarEnabled={false}
        onPress={(event: { features?: Array<{ properties?: { slug?: string } }> }) => {
          const slug = event?.features?.[0]?.properties?.slug;
          if (slug) onSelect(slug);
        }}
      >
        <Camera
          key={`location-focus-${cameraRevision}`}
          centerCoordinate={[camera.longitude, camera.latitude]}
          zoomLevel={camera.zoom}
          animationMode="flyTo"
          animationDuration={600}
        />
        {showUserLocation && UserLocation ? <UserLocation visible /> : null}
        {showTerritories ? <ShapeSource
          id="territories"
          shape={collection}
          onPress={(event: { features?: Array<{ properties?: { slug?: string } }> }) => {
            const slug = event?.features?.[0]?.properties?.slug;
            if (slug) onSelect(slug);
          }}
        >
          <LineLayer
            id="territory-lines"
            style={{
              lineColor: [
                'case',
                ['get', 'selected'],
                shell.accent,
                'rgba(197,165,114,0.45)',
              ],
              lineWidth: ['case', ['get', 'selected'], 5, 2.5],
              lineOpacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource> : null}
        {showTerritories && endpoints ? (
          <ShapeSource
            id="endpoints"
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { role: 'start' },
                  geometry: { type: 'Point', coordinates: endpoints.start },
                },
                {
                  type: 'Feature',
                  properties: { role: 'finish' },
                  geometry: { type: 'Point', coordinates: endpoints.finish },
                },
              ],
            }}
          >
            <CircleLayer
              id="endpoint-circles"
              style={{
                circleRadius: 6,
                circleColor: [
                  'match',
                  ['get', 'role'],
                  'start',
                  '#7CFFB2',
                  'finish',
                  shell.accent,
                  shell.accent,
                ],
                circleStrokeWidth: 2,
                circleStrokeColor: '#05070C',
              }}
            />
          </ShapeSource>
        ) : null}
      </MapView>
      <View style={styles.badge} pointerEvents="none">
        <Text variant="caption" gold>
          {badge}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: shell.mapVoid,
    gap: 8,
  },
  muted: {
    color: shell.muted,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(5,7,12,0.72)',
  },
});
