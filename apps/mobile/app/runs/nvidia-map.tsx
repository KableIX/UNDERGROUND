import { FittedPhoto } from '../../src/components/FittedPhoto';
import { isTripStorageTemporary } from '../../src/drive/trip-store';
import {GarageVehicleSelect,useGarageVehicles} from '../../src/drive/GarageVehicleSelect';
import {useState } from 'react';
import { ActiveRunDashboard } from '../../src/components/ActiveRunDashboard';
import { Alert } from 'react-native';
import { usePersistentDrive } from '../../src/drive/use-persistent-drive';
import { useMapLocation } from '../../src/lib/use-map-location';
import { formatDistanceM, formatDurationMs } from '../../src/drive/format';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TerritoryDefinition } from '@underground/domain';
import { Text } from '@underground/ui';
import { MapboxTerritoryMap } from '../../src/components/conquest/MapboxTerritoryMap';
import route from '../../src/data/nvidia-campus-route.json';
import { getCuratedRun } from '../../src/data/curated-runs';

const coordinates = route.geometry.coordinates as [number, number][];
const turns=[
  {index:0,instruction:'Follow Scott Boulevard towards San Tomas Expressway.'},
  {index:45,instruction:'Turn right onto San Tomas Expressway.'},
  {index:62,instruction:'Turn right onto Walsh Avenue.'},
  {index:133,instruction:'Turn right onto Bowers Avenue.'},
];
const territory: TerritoryDefinition = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa05',
  slug: 'nvidia-campus-loop',
  name: 'NVIDIA Campus Loop',
  districtSlug: 'silicon-valley-dev',
  version: 1, status: 'draft', eligibleWeight: 1,
  geometry: { type: 'LineString', coordinates },
  geometryLabel: 'OSM_ROAD_NODE_PREVIEW_GATES_UNVERIFIED',
  createdAt: '2026-11-06T02:00:00.000Z',
};
const territories = [territory];
const camera = {
  longitude: (Math.min(...coordinates.map(p => p[0])) + Math.max(...coordinates.map(p => p[0]))) / 2,
  latitude: (Math.min(...coordinates.map(p => p[1])) + Math.max(...coordinates.map(p => p[1]))) / 2,
  zoom: 14,
};

export default function NvidiaRouteMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [revision, setRevision] = useState(0);
  const drive = usePersistentDrive();
  const location = useMapLocation();
  const [busy, setBusy] = useState(false);
  const status = drive.state.session.status;
  const temporaryStorage = isTripStorageTemporary();
  const [dashboard, setDashboard] = useState(false);
  const garage=useGarageVehicles();
  const active = status === 'recording';
  const paused = status === 'paused' || status === 'interrupted';
  async function action(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch { Alert.alert('Recording unavailable', 'Please retry.'); }
    finally { setBusy(false); }
  }
  function leave() {
    if (active || paused) {
      Alert.alert('Leave run?', 'Pause recording and leave the run map?', [
        { text: 'Keep open', style: 'cancel' },
        { text: 'Pause and leave', onPress: () => void action(async () => { await drive.pause(); router.back(); }) },
      ]);
    } else router.back();
  }
  const run = getCuratedRun('nvidia-campus-loop')!;
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ActiveRunDashboard visible={dashboard} drive={drive} temporary={temporaryStorage} busy={busy}
        onClose={() => setDashboard(false)} onPause={() => void action(drive.pause)}
        onResume={() => void action(drive.resume)} onEnd={() => void action(drive.end)} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leave} style={styles.button}>
          <Text style={styles.action}>BACK</Text>
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>NVIDIA CAMPUS LOOP</Text>
          <Text style={styles.muted}>SILICON VALLEY / {(route.properties.distanceMeters / 1000).toFixed(1)} KM LOOP</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Show the entire campus loop" onPress={() => setRevision(r => r + 1)} style={styles.button}>
          <Text style={styles.action}>FIT</Text>
        </Pressable>
      </View>
      <View style={styles.map}>
        <MapboxTerritoryMap territories={territories} selectedSlug={territory.slug}
          onSelect={() => {}} camera={camera} cameraRevision={revision}
          navTitle="NVIDIA Campus Loop" maneuvers={turns}
          verifyStart={async()=>{
            if(active||paused||drive.recovering){Alert.alert('Recording in progress','Finish the existing recording before starting another loop.');return false;}
            if(garage.loading){Alert.alert('Loading your garage', 'Try again in a moment.');return false;}
            if(garage.cars.length>1&&!garage.selected){Alert.alert('Choose your car first');return false;}return true;
          }}
          onDriveStart={()=>drive.start({...garage.trip,curatedRouteId:territory.slug})} onDriveFinish={drive.end} elapsedMs={drive.summary?.durationMs} interrupted={paused} resumeTrip={drive.resume}
          fitCoordinates={coordinates} badge="NVIDIA / ROUTE PREVIEW"
          showUserLocation={location.status === 'granted'} userPosition={location.position} />
      </View>
      <View style={styles.summary}>
        {active || paused || status === 'ended' ? <Pressable style={styles.primary} onPress={() => setDashboard(true)}>
          <Text style={styles.primaryText}>OPEN RUN DASHBOARD</Text>
        </Pressable> : null}
        {!active && !paused && <GarageVehicleSelect garage={garage}/>}
        <View style={styles.startRow}>
          <View style={styles.dot} />
          <View style={styles.titleBlock}>
            <Text style={styles.start}>START / FINISH</Text>
            <Text style={styles.address}>{route.properties.startLabel}</Text>
          </View>
          {run.cover && <FittedPhoto source={run.cover} width={64} radius={3} accessibilityLabel="NVIDIA headquarters" />}
        </View>
        <Text style={styles.sequence}>Scott → San Tomas → Walsh → Bowers → Scott</Text>
        <Text style={styles.start}>{active ? '● RECORDING' : paused ? 'PAUSED / RESUME AVAILABLE' : status === 'ended' ? 'RECORDING ENDED' : status === 'permission_denied' ? 'LOCATION PERMISSION NEEDED' : status === 'unavailable' ? 'GPS UNAVAILABLE / RETRY' : 'READY TO DRIVE'}</Text>
        {drive.summary ? <Text style={styles.address}>{formatDistanceM(drive.summary.distanceM)} recorded · {formatDurationMs(drive.summary.durationMs)} · {drive.state.samples.length} GPS samples</Text> : null}
        <Text style={styles.muted}>{location.position?.accuracyM != null ? `GPS ±${Math.round(location.position.accuracyM)} m` : 'Waiting for GPS'} · {drive.state.session.gpsQuality}</Text>
        <View style={styles.footer}>
          {(active||paused) && <Pressable style={styles.primary} disabled={busy || drive.recovering} accessibilityRole="button"
            onPress={() => void action(active ? drive.pause : drive.resume)}>
            <Text style={styles.primaryText}>{busy || drive.recovering ? 'PLEASE WAIT' : active ? 'PAUSE' : paused ? 'RESUME RUN' : 'START RUN'}</Text>
          </Pressable>}
          {active || paused ? <Pressable style={styles.button} disabled={busy} accessibilityRole="button"
            onPress={() => void action(drive.end)}><Text style={styles.action}>{temporaryStorage ? 'END RUN' : 'END & SAVE'}</Text></Pressable> : null}
          {status === 'ended' ? <Pressable style={styles.button} onPress={() => router.push('/trips')}><Text style={styles.action}>HISTORY</Text></Pressable> : null}
        </View>
        <Text style={styles.muted}>Drive the loop from the start marker. Keep this screen open: locking or switching apps pauses GPS. {temporaryStorage ? 'Trip storage is temporary in this build: recordings will be lost when the app restarts. A new iPhone build is needed for permanent saving.' : 'End & save stores your trip locally.'} Route completion verification is not enabled yet.</Text>
        <View style={styles.footer}>
          <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(route.properties.sourceUrl)}>
            <Text style={styles.credit}>© OpenStreetMap contributors / ODbL</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={active || paused} onPress={() => router.push({ pathname: '/runs/[slug]', params: { slug: territory.slug } })}>
            <Text style={styles.action}>DETAILS</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#08090A' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 10 },
  button: { padding: 12 },
  titleBlock: { flex: 1, gap: 4 },
  title: { color: '#FFFFFF', fontFamily: 'BarlowCondensed_700Bold', fontSize: 23 },
  action: { color: '#D0B88F', fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  muted: { color: '#B8B6B2', fontSize: 10, lineHeight: 16 },
  primary: { flex: 1, backgroundColor: '#76FF03', padding: 15, alignItems: 'center', borderRadius: 5 },
  primaryText: { color: '#08090A', fontWeight: '700', fontSize: 14 },
  map: { flex: 1, minHeight: 220 },
  summary: { padding: 16, gap: 11 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7CFFB2' },
  start: { color: '#7CFFB2', fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  address: { color: '#FFFFFF', fontSize: 13 },
  sequence: { color: '#FFFFFF', fontSize: 12, lineHeight: 19 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credit: { color: '#B8B6B2', fontSize: 9 },
});
