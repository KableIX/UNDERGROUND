import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { probeNativeMapbox } from '../lib/mapbox-native';
import { probeReactNativeMapsModule } from '../lib/native-module-probe';
import type { MapSighting, SealedEnvelope } from './client';
import { tierLabel } from './copy';
import { MAP_MAX_ZOOM, fitRegion, groupCells, regionToBounds, tierColor, type MapCell, type Region } from './map';
import { TierMark } from './TierMark';

type Mapbox = {
  MapView: ComponentType<Record<string, unknown>>;
  Camera: ComponentType<Record<string, unknown>>;
  ShapeSource: ComponentType<Record<string, unknown>>;
  CircleLayer: ComponentType<Record<string, unknown>>;
};

type AppleMaps = {
  default: ComponentType<Record<string, unknown>>;
  Circle: ComponentType<Record<string, unknown>>;
  Marker: ComponentType<Record<string, unknown>>;
  PROVIDER_DEFAULT?: string;
};

type Engine = { kind: 'mapbox'; api: Mapbox } | { kind: 'apple'; api: AppleMaps } | { kind: 'none' };

/** Same order as the main Map tab: Mapbox when configured, else Apple MapKit, else text. */
function loadEngine(): Engine {
  if (probeNativeMapbox().ok) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@rnmapbox/maps');
      const api = mod.default ?? mod;
      if (api.MapView) return { kind: 'mapbox', api: api as Mapbox };
    } catch {
      // fall through
    }
  }
  // JS presence alone is not enough: rendering AIRMap without the native view crashes.
  if (probeReactNativeMapsModule().usable) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-maps');
      if (mod?.default && mod?.Circle && mod?.Marker) return { kind: 'apple', api: mod as AppleMaps };
    } catch {
      // fall through
    }
  }
  return { kind: 'none' };
}

type Cell = MapCell<MapSighting>;

/** One soft area per neighborhood cell, never a pin on a spot. Kept for the Mapbox path and tests. */
export function cellsToFeatures(sightings: MapSighting[]) {
  return {
    type: 'FeatureCollection' as const,
    features: groupCells(sightings).map((c) => ({
      type: 'Feature' as const,
      properties: { id: c.id, count: c.items.length, color: tierColor(c.tier), radius: c.radiusM },
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
    })),
  };
}

export function SightingsLayer({
  sightings,
  envelopes,
  center,
  onBounds,
  onReport,
}: {
  sightings: MapSighting[];
  envelopes: SealedEnvelope[];
  center: { lat: number; lng: number } | null;
  onBounds?: (b: { west: number; south: number; east: number; north: number }) => void;
  onReport: (s: MapSighting) => void;
}) {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [envelope, setEnvelope] = useState<SealedEnvelope | null>(null);
  useEffect(() => setEngine(loadEngine()), []);
  const cells = useMemo(() => groupCells(sightings), [sightings]);
  // The opening frame is fixed once: refetches while panning must not yank the camera.
  const opening = useRef<Region | null>(null);
  if (!opening.current) opening.current = fitRegion(center, cells.map((c) => ({ lat: c.lat, lng: c.lng })));
  const picked = cells.find((c) => c.id === selected) ?? null;

  function pickCell(id: string) {
    setEnvelope(null);
    setSelected((cur) => (cur === id ? null : id));
  }
  function pickEnvelope(e: SealedEnvelope) {
    setSelected(null);
    setEnvelope((cur) => (cur?.id === e.id ? null : e));
  }

  if (!engine) return <View style={s.map} />;

  if (engine.kind === 'none') {
    return (
      <View style={s.fallback}>
        <Text style={s.caption}>MAP</Text>
        <Text style={s.body}>
          {sightings.length} recent {sightings.length === 1 ? 'sighting' : 'sightings'} in {cells.length} {cells.length === 1 ? 'neighborhood' : 'neighborhoods'}.
        </Text>
        {envelopes.length ? <Text style={s.body}>{envelopes.length} sealed {envelopes.length === 1 ? 'envelope' : 'envelopes'} within 5 km.</Text> : null}
        <Text style={s.small}>This build has no map engine. Install the current iOS build for the map.</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={s.map}>
        {engine.kind === 'apple' ? (
          <AppleLayer
            api={engine.api}
            cells={cells}
            envelopes={envelopes}
            region={opening.current}
            selected={selected}
            onCell={pickCell}
            onEnvelope={pickEnvelope}
            onBounds={onBounds}
          />
        ) : (
          <MapboxLayer api={engine.api} sightings={sightings} envelopes={envelopes} region={opening.current} onCell={pickCell} onBounds={onBounds} />
        )}
        <View pointerEvents="none" style={s.badge}>
          <Text style={s.badgeText}>NEIGHBORHOOD SCALE · HOURS AFTER</Text>
        </View>
      </View>
      <Legend />
      {picked ? <CellCard cell={picked} onReport={onReport} onClose={() => setSelected(null)} /> : null}
      {envelope ? (
        <View style={[s.card, { borderColor: '#47443F' }]}>
          <Text style={s.caption}>SEALED ENVELOPE</Text>
          <Text style={s.title}>{envelope.anchor_name}</Text>
          <Text style={s.body}>Open it in person, within 60 meters. Listed below.</Text>
        </View>
      ) : null}
    </View>
  );
}

function AppleLayer({
  api,
  cells,
  envelopes,
  region,
  selected,
  onCell,
  onEnvelope,
  onBounds,
}: {
  api: AppleMaps;
  cells: Cell[];
  envelopes: SealedEnvelope[];
  region: Region;
  selected: string | null;
  onCell: (id: string) => void;
  onEnvelope: (e: SealedEnvelope) => void;
  onBounds?: (b: { west: number; south: number; east: number; north: number }) => void;
}) {
  const { default: MapView, Circle, Marker } = api;
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      // Explicit Apple/default provider, as on the main Map tab (never Google on iOS).
      provider={api.PROVIDER_DEFAULT}
      initialRegion={region}
      onRegionChangeComplete={(next: Region) => onBounds?.(regionToBounds(next))}
      mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
      userInterfaceStyle="dark"
      showsPointsOfInterest={false}
      showsBuildings={false}
      showsUserLocation={false}
      showsCompass={false}
      pitchEnabled={false}
      rotateEnabled={false}
      maxZoomLevel={MAP_MAX_ZOOM}
      accessibilityLabel="SupercarGO sightings by neighborhood"
    >
      {cells.map((c) => (
        <Circle
          key={'area-' + c.id}
          center={{ latitude: c.lat, longitude: c.lng }}
          radius={c.radiusM}
          fillColor={tierColor(c.tier) + (c.id === selected ? '55' : '2E')}
          strokeColor={tierColor(c.tier) + 'B3'}
          strokeWidth={c.id === selected ? 2 : 1}
        />
      ))}
      {cells.map((c) => (
        <Marker
          key={'mark-' + c.id}
          identifier={c.id}
          coordinate={{ latitude: c.lat, longitude: c.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          onPress={() => onCell(c.id)}
          accessibilityLabel={`${c.items.length} ${c.items.length === 1 ? 'sighting' : 'sightings'}, rarest ${tierLabel(c.tier)}`}
        >
          <View style={[s.mark, { borderColor: tierColor(c.tier), backgroundColor: c.id === selected ? tierColor(c.tier) : '#08090AE6' }]}>
            <Text style={[s.markText, { color: c.id === selected ? '#08090A' : tierColor(c.tier) }]}>{c.items.length}</Text>
          </View>
        </Marker>
      ))}
      {envelopes.map((e) => (
        <Marker
          key={'env-' + e.id}
          identifier={'env-' + e.id}
          coordinate={{ latitude: e.lat, longitude: e.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          onPress={() => onEnvelope(e)}
          accessibilityLabel={`Sealed envelope at ${e.anchor_name}`}
        >
          <View style={s.envelope}>
            <MaterialCommunityIcons name="email-lock" size={15} color="#F4F2ED" />
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

function MapboxLayer({
  api,
  sightings,
  envelopes,
  region,
  onCell,
  onBounds,
}: {
  api: Mapbox;
  sightings: MapSighting[];
  envelopes: SealedEnvelope[];
  region: Region;
  onCell: (id: string) => void;
  onBounds?: (b: { west: number; south: number; east: number; north: number }) => void;
}) {
  const { MapView, Camera, ShapeSource, CircleLayer } = api;
  const shape = useMemo(() => cellsToFeatures(sightings), [sightings]);
  const sealed = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: envelopes.map((e) => ({ type: 'Feature' as const, properties: { id: e.id }, geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] } })),
    }),
    [envelopes],
  );
  const bounds = regionToBounds(region);
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL="mapbox://styles/mapbox/dark-v11"
      logoEnabled
      attributionEnabled
      scaleBarEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      onMapIdle={(e: { properties: { bounds?: { sw: number[]; ne: number[] } } }) => {
        const b = e.properties.bounds;
        if (b && onBounds) onBounds({ west: b.sw[0]!, south: b.sw[1]!, east: b.ne[0]!, north: b.ne[1]! });
      }}
    >
      <Camera bounds={{ sw: [bounds.west, bounds.south], ne: [bounds.east, bounds.north] }} maxZoomLevel={MAP_MAX_ZOOM} animationMode="none" />
      <ShapeSource
        id="supercargo-cells"
        shape={shape}
        onPress={(e: { features?: Array<{ properties?: { id?: string } }> }) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) onCell(id);
        }}
      >
        <CircleLayer
          id="supercargo-cell-discs"
          style={{
            circleRadius: ['interpolate', ['exponential', 2], ['zoom'], 8, ['/', ['get', 'radius'], 600], 13, ['/', ['get', 'radius'], 19]],
            circleColor: ['get', 'color'],
            circleOpacity: 0.22,
            circleStrokeWidth: 1,
            circleStrokeColor: ['get', 'color'],
            circleBlur: 0.3,
          }}
        />
        <CircleLayer
          id="supercargo-cell-marks"
          style={{ circleRadius: 9, circleColor: '#08090A', circleStrokeWidth: 2, circleStrokeColor: ['get', 'color'] }}
        />
      </ShapeSource>
      <ShapeSource id="supercargo-envelopes" shape={sealed}>
        <CircleLayer id="supercargo-envelope-marks" style={{ circleRadius: 6, circleColor: '#08090A', circleStrokeWidth: 1.5, circleStrokeColor: '#F4F2ED' }} />
      </ShapeSource>
    </MapView>
  );
}

function Legend() {
  const tiers = ['open', 'limited', 'numbered', 'allocated', 'atelier', 'singular'] as const;
  return (
    <View style={s.legend} accessibilityLabel="Rarity colors">
      {tiers.map((t) => (
        <View key={t} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: tierColor(t) }]} />
          <Text style={s.legendText}>{tierLabel(t).toUpperCase()}</Text>
        </View>
      ))}
      <View style={s.legendItem}>
        <MaterialCommunityIcons name="email-lock" size={11} color="#F4F2ED" />
        <Text style={s.legendText}>ENVELOPE</Text>
      </View>
    </View>
  );
}

function CellCard({ cell, onReport, onClose }: { cell: Cell; onReport: (s: MapSighting) => void; onClose: () => void }) {
  return (
    <View style={[s.card, { borderColor: tierColor(cell.tier) + '99' }]}>
      <View style={s.row}>
        <Text style={[s.caption, { flex: 1 }]}>
          {cell.items.length} {cell.items.length === 1 ? 'SIGHTING' : 'SIGHTINGS'} IN THIS NEIGHBORHOOD
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose}>
          <Text style={s.report}>CLOSE</Text>
        </Pressable>
      </View>
      {cell.items.map((x) => (
        <View key={x.id} style={s.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.title}>
              {x.make} {x.model}
            </Text>
            <TierMark tier={x.tier} />
            <Text style={s.small}>{`SEEN ${x.seen_on}${x.spotter_number ? ` · NO. ${x.spotter_number}` : ''}`}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Report ${x.make} ${x.model}`} hitSlop={10} onPress={() => onReport(x)}>
            <Text style={s.report}>REPORT</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  map: { height: 340, borderWidth: 1, borderColor: '#2C2D31', overflow: 'hidden', backgroundColor: '#0E0F12' },
  fallback: { padding: 16, gap: 10, borderWidth: 1, borderColor: '#2C2D31', backgroundColor: '#0E0F12' },
  caption: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1.6, color: '#8F8F92' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#B7B7B8' },
  small: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8F8F92' },
  title: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 22, lineHeight: 26, color: '#F4F2ED' },
  badge: { position: 'absolute', top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: 'rgba(5,7,12,0.82)' },
  badgeText: { fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 1.4, color: '#C6B08B' },
  mark: { minWidth: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  markText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  envelope: { width: 26, height: 26, borderRadius: 4, borderWidth: 1.5, borderColor: '#F4F2ED', backgroundColor: '#08090A', alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontFamily: 'DMSans_500Medium', fontSize: 10, letterSpacing: 1.2, color: '#8F8F92' },
  card: { backgroundColor: '#111215', borderWidth: 1, borderColor: '#24252A', padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  report: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 1.4, color: '#8F8F92' },
});
