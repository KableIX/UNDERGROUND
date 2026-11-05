import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { useForegroundDrive } from '../../lib/foreground-drive';
import {
  SANTA_CLARA_START, WORLD_START, regionAround,
  type WorldMapStyle, type WorldRegion,
} from '../../lib/world-map-config';
import { shell } from '../../theme/shell';

/**
 * Map-first validation surface. Real worldwide MapKit road geometry; NO
 * territory definitions, capture engine, ownership, or overlay fixtures.
 */
export function FullWorldMap() {
  const [MapView, setMapView] = useState<ComponentType<Record<string, unknown>> | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [style, setStyle] = useState<WorldMapStyle>('standard');
  const [region, setRegion] = useState<WorldRegion>(SANTA_CLARA_START);
  const [resetId, setResetId] = useState(0);
  const [mode, setMode] = useState<'explore' | 'drive'>('explore');
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [locationStatus, setLocationStatus] = useState('GPS OFF');
  const [locating, setLocating] = useState(false);
  const drive = useForegroundDrive();

  useEffect(() => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require('react-native-maps') as Record<string, unknown>;
      const component = (module.default ?? module.MapView) as ComponentType<Record<string, unknown>> | undefined;
      if (!component) throw new Error('native_map_missing');
      setMapView(() => component);
    } catch {
      setMapError('Native Apple Maps unavailable. Install the latest signed iOS development build.');
    }
  }, []);

  useEffect(() => {
    if (drive.status === 'recording') {
      setLocationAllowed(true);
      setLocationStatus('GPS RECORDING');
    } else if (drive.status === 'permission_denied') {
      setLocationStatus('PERMISSION DENIED');
    }
  }, [drive.status]);

  function recenter(next: WorldRegion) {
    setRegion(next);
    setReady(false);
    setResetId(x => x + 1);
  }

  async function locate() {
    if (locating) return;
    setLocating(true);
    setLocationStatus('LOCATING');
    try {
      // Native location is requested only when the member asks for it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const location = require('expo-location') as typeof import('expo-location');
      const permission = await location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationStatus('PERMISSION DENIED');
        return;
      }
      setLocationAllowed(true);
      const fix = await location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced });
      recenter(regionAround(fix.coords.latitude, fix.coords.longitude));
      setLocationStatus('POSITION FOUND');
    } catch {
      setLocationStatus('GPS UNAVAILABLE');
    } finally {
      setLocating(false);
    }
  }

  function setDriveMode(next: 'explore' | 'drive') {
    if (mode === 'drive' && next === 'explore' && drive.status === 'recording') drive.pause();
    setMode(next);
  }

  return (
    <View style={styles.root}>
      {MapView ? (
        <MapView
          key={resetId}
          style={StyleSheet.absoluteFillObject}
          initialRegion={region}
          mapType={style}
          showsUserLocation={locationAllowed}
          followsUserLocation={mode === 'drive' && drive.status === 'recording'}
          showsMyLocationButton={false}
          showsCompass
          pitchEnabled
          rotateEnabled
          scrollEnabled
          zoomEnabled
          onMapReady={() => setReady(true)}
          accessibilityLabel="Full interactive world road map"
        />
      ) : (
        <View style={styles.missing}>
          <Text variant="title" gold>WORLD MAP</Text>
          <Text style={styles.sub}>{mapError ?? 'Loading native map.'}</Text>
          {!mapError ? <ActivityIndicator color={shell.accent} /> : null}
        </View>
      )}
      <View style={styles.top} pointerEvents="box-none">
        <View style={styles.status} pointerEvents="none">
          <Text variant="caption" gold>UNDERGROUND · WORLD MAP</Text>
          <Text style={styles.mini}>{ready ? 'MAP READY' : MapView ? 'MAP LOADING' : 'MAP UNAVAILABLE'} · {locationStatus}</Text>
        </View>
        <View style={styles.row}>
          <Action label="ROADS" active={style === 'standard'} onPress={() => setStyle('standard')} />
          <Action label="SATELLITE" active={style === 'satellite'} onPress={() => setStyle('satellite')} />
          <Action label="HYBRID" active={style === 'hybrid'} onPress={() => setStyle('hybrid')} />
        </View>
        <View style={styles.row}>
          <Action label={locating ? 'LOCATING…' : 'MY LOCATION'} disabled={locating} active={locationAllowed} onPress={() => void locate()} />
          <Action label="WORLD" onPress={() => recenter(WORLD_START)} />
          <Action label="SANTA CLARA" onPress={() => recenter(SANTA_CLARA_START)} />
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={styles.row}>
          <Action label="EXPLORE" active={mode === 'explore'} onPress={() => setDriveMode('explore')} />
          <Action label="DRIVE" active={mode === 'drive'} onPress={() => setDriveMode('drive')} />
        </View>
        {mode === 'explore' ? (
          <View style={styles.message}>
            <Text variant="caption" gold>MAP-FIRST VALIDATION</Text>
            <Text style={styles.sub}>Pan and zoom anywhere. Our territories will be added after this map works on your iPhone.</Text>
          </View>
        ) : (
          <View style={styles.message}>
            <Text variant="caption" gold>PRIVATE DRIVE · FOREGROUND ONLY</Text>
            <Text style={styles.sub}>
              {drive.status.toUpperCase()} · {(drive.distanceM / 1609.344).toFixed(2)} MI · {Math.floor(drive.elapsedSeconds / 60)}:{String(drive.elapsedSeconds % 60).padStart(2, '0')} · {drive.points} GPS FIXES
            </Text>
            <Text style={styles.sub}>Not saved, validated or counted toward territory ownership. Start before driving.</Text>
            <View style={styles.row}>
              {drive.status === 'recording'
                ? <Action label="PAUSE" active onPress={drive.pause} />
                : <Action label={drive.status === 'paused' ? 'RESUME' : 'START DRIVE'} active onPress={() => void drive.start()} />}
              <Action label="END" onPress={drive.finish} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function Action({ label, active = false, disabled = false, onPress }: {
  label: string; active?: boolean; disabled?: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, active && styles.actionActive, disabled && styles.disabled]}
    >
      <Text variant="caption" gold={active} style={active ? undefined : styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.mapVoid },
  missing: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  sub: { color: '#CAC7C3', lineHeight: 19 },
  top: { position: 'absolute', top: 10, left: 10, right: 10, gap: 8 },
  status: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(5,7,12,0.92)', padding: 9,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(197,165,114,0.30)',
  },
  mini: { marginTop: 3, fontSize: 10, color: shell.muted },
  row: { flexDirection: 'row', gap: 7 },
  action: {
    flex: 1, minHeight: 40, paddingHorizontal: 4, paddingVertical: 7,
    justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(5,7,12,0.91)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(197,165,114,0.28)',
  },
  actionActive: { borderColor: shell.accent, backgroundColor: 'rgba(48,38,22,0.95)' },
  disabled: { opacity: 0.42 },
  actionText: { color: '#CAC7C3', fontSize: 10 },
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 16,
    backgroundColor: 'rgba(5,7,12,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: shell.accent,
    gap: 9,
  },
  message: { gap: 7 },
});
