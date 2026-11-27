import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { probeNativeMapbox } from '../lib/mapbox-native';
import type { MapSighting, SealedEnvelope } from './client';
import { TierMark } from './TierMark';

type Mapbox = {
  MapView: ComponentType<Record<string, unknown>>;
  Camera: ComponentType<Record<string, unknown>>;
  ShapeSource: ComponentType<Record<string, unknown>>;
  CircleLayer: ComponentType<Record<string, unknown>>;
};

function loadMapbox(): Mapbox | null {
  if (!probeNativeMapbox().ok) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@rnmapbox/maps');
    const api = mod.default ?? mod;
    return api.MapView ? (api as Mapbox) : null;
  } catch {
    return null;
  }
}

/** One soft disc per neighborhood cell, never a pin. Count, not location, is the signal. */
export function cellsToFeatures(sightings: MapSighting[]) {
  const cells = new Map<string, { lat: number; lng: number; count: number; rarest: number }>();
  const order = ['open', 'limited', 'numbered', 'allocated', 'atelier', 'singular'];
  for (const s of sightings) {
    const cell = cells.get(s.cell_id) ?? { lat: s.cell_lat, lng: s.cell_lng, count: 0, rarest: 0 };
    cell.count += 1;
    cell.rarest = Math.max(cell.rarest, order.indexOf(s.tier));
    cells.set(s.cell_id, cell);
  }
  return {
    type: 'FeatureCollection' as const,
    features: [...cells].map(([id, c]) => ({
      type: 'Feature' as const,
      properties: { id, count: c.count, rarest: c.rarest },
      geometry: { type: 'Point' as const, coordinates: [c.lng, c.lat] },
    })),
  };
}

export function SightingsLayer({
  sightings,
  envelopes,
  center,
  onBounds,
}: {
  sightings: MapSighting[];
  envelopes: SealedEnvelope[];
  center: { lat: number; lng: number } | null;
  onBounds?: (b: { west: number; south: number; east: number; north: number }) => void;
}) {
  const [Mapbox, setMapbox] = useState<Mapbox | null>(null);
  useEffect(() => setMapbox(loadMapbox()), []);
  const cells = useMemo(() => cellsToFeatures(sightings), [sightings]);
  const sealed = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: envelopes.map((e) => ({ type: 'Feature' as const, properties: { id: e.id }, geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] } })),
    }),
    [envelopes],
  );

  if (!Mapbox) {
    return (
      <View style={s.fallback}>
        <Text style={s.caption}>RECENT SIGHTINGS NEARBY</Text>
        {sightings.length === 0 ? <Text style={s.body}>Nothing to show yet.</Text> : null}
        {sightings.slice(0, 12).map((x) => (
          <View key={x.id} style={s.row}>
            <Text style={s.car}>{x.make} {x.model}</Text>
            <TierMark tier={x.tier} />
          </View>
        ))}
        {envelopes.length ? <Text style={s.body}>{envelopes.length} sealed {envelopes.length === 1 ? 'envelope' : 'envelopes'} within 5 km.</Text> : null}
      </View>
    );
  }
  const { MapView, Camera, ShapeSource, CircleLayer } = Mapbox;
  return (
    <View style={s.map}>
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL="mapbox://styles/mapbox/dark-v11"
        logoEnabled
        attributionEnabled
        scaleBarEnabled={false}
        onMapIdle={(e: { properties: { bounds?: { sw: number[]; ne: number[] } } }) => {
          const b = e.properties.bounds;
          if (b && onBounds) onBounds({ west: b.sw[0]!, south: b.sw[1]!, east: b.ne[0]!, north: b.ne[1]! });
        }}
      >
        <Camera centerCoordinate={center ? [center.lng, center.lat] : [-121.9, 37.33]} zoomLevel={10.5} maxZoomLevel={13} animationMode="none" />
        <ShapeSource id="supercargo-cells" shape={cells}>
          <CircleLayer
            id="supercargo-cell-discs"
            style={{
              circleRadius: ['interpolate', ['linear'], ['get', 'count'], 1, 14, 10, 26],
              circleColor: ['case', ['==', ['get', 'rarest'], 5], '#C6B08B', '#B7B7B8'],
              circleOpacity: 0.16,
              circleStrokeWidth: 1,
              circleStrokeColor: ['case', ['==', ['get', 'rarest'], 5], '#C6B08B', '#5A5B60'],
              circleBlur: 0.4,
            }}
          />
        </ShapeSource>
        <ShapeSource id="supercargo-envelopes" shape={sealed}>
          <CircleLayer id="supercargo-envelope-marks" style={{ circleRadius: 5, circleColor: '#08090A', circleStrokeWidth: 1.5, circleStrokeColor: '#F4F2ED' }} />
        </ShapeSource>
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  map: { height: 300, borderWidth: 1, borderColor: '#2C2D31', overflow: 'hidden' },
  fallback: { padding: 16, gap: 10, borderWidth: 1, borderColor: '#2C2D31', backgroundColor: '#0E0F12' },
  caption: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1.6, color: '#8F8F92' },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: '#B7B7B8' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  car: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 20, color: '#F4F2ED' },
});
