import { MapLayersButton, useLayers, useRouteHistory } from '../../map-layers/controls';
import { cameraPins, snapshot, type Box } from '../../map-layers/cameras';
import { drawZones, zoneLabel, type Zone } from '../../map-layers/history';
import { FinishBanner } from './FinishBanner';
import { useSession } from '../../session/SessionContext';
import { saveResult } from '../../drive/result-store';
import { runFix, type RunFix } from '../../drive/finish-proof';
import type { Fix } from '../../drive/route-navigation';
import { RouteConditions } from './RouteConditions';
import { conditionPosition } from '../../drive/route-condition-match';
import { RunClock } from './RunClock';
import { usePersistentDrive } from '../../drive/use-persistent-drive';
import { GarageVehicleSelect, useGarageVehicles } from '../../drive/GarageVehicleSelect';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApproach } from '../../drive/use-approach';
import { qualityLabel, voiceCue } from '../../drive/navigation-voice';
import { useNavigationVoice } from '../../drive/use-navigation-voice';
import { useMapLighting } from '../../lib/use-map-lighting';
import { useMapLocation } from '../../lib/use-map-location';
import { advanceRoute, atRouteStart, initialProgress, routeDistances } from '../../drive/route-navigation';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { MapBeacon, beaconAnchor, campusPoint, locationAnchor } from './MapBeacon';
import { exploreRoutes } from '../../data/explore-routes';
import { WorldMapFallback } from './WorldMapFallback';

type Camera = { longitude: number; latitude: number; zoom: number };

type Props = {
  onExploreRoute?: (slug: string) => void;
  territories: TerritoryDefinition[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  camera: Camera;
  onDriveStart?:()=>Promise<boolean>;
  onDriveFinish?:()=>Promise<void>;
  resultKind?: 'RUN' | 'CRUISE';
  onRouteComplete?: (trace: RunFix[], finishMs: number) => Promise<void>;
  vehicleControl?: import('react').ReactNode;
  elapsedMs?: number;
  interrupted?: boolean;
  resumeTrip?: () => Promise<void>;
  navTitle?: string;
  activity?: 'Run' | 'Cruise';
  previewOnly?: boolean;
  verifyStart?: () => Promise<boolean>;
  historyZones?: Zone[];
  approachLeg?: boolean;
  signalGap?: { entryIndex: number; exitIndex: number };
  maneuvers?: { index: number; instruction: string }[];
  onPan?: () => void;
  badge: string;
  forceFallback?: boolean;
  showTerritories?: boolean;
  followUser?: boolean;
  showUserLocation?: boolean;
  userPosition?: { longitude: number; latitude: number; accuracyM: number | null } | null;
  cameraRevision?: number;
  streetView?: boolean;
  fitCoordinates?: [number, number][];
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
  FillExtrusionLayer: ComponentType<Record<string, unknown>>;
  SymbolLayer: ComponentType<Record<string, unknown>>;
  MarkerView: ComponentType<Record<string, unknown>>;
  BackgroundLayer: ComponentType<Record<string, unknown>>;
  RasterLayer: ComponentType<Record<string, unknown>>;
  RasterSource: ComponentType<Record<string, unknown>>;
  UserLocation?: ComponentType<Record<string, unknown>>;
  StyleURL?: Record<string, string>;
};

/**
 * Native Mapbox when tokens + SDK are linked; otherwise Apple MapKit
 * (WorldMapFallback / react-native-maps). Never crash on missing natives.
 * Requires custom Expo dev client — Expo Go unsupported.
 * Device rendering is unverified in this Linux agent environment.
 */
export function MapboxTerritoryMap(input: Props) {
  const layers = useLayers();
  const history = useRouteHistory(input.fitCoordinates?.length ? input.selectedSlug : null, layers.history);
  const props = { ...input, historyZones: history?.zones };
  const historyNote = history?.failed ? 'Member history unavailable' : history?.zones.length
    ? 'Before you go · ' + history.zones.length + (history.zones.length === 1 ? ' segment' : ' segments') + ' with recurring speed checks' : '';
  const [active, setActive] = useState(false);
  const points = props.fitCoordinates;
  if (!points || points.length < 2) return <TerritorySurface {...props} />;
  const canStart = !props.previewOnly || !!props.verifyStart;
  return <View style={styles.fill}>
    <TerritorySurface {...props} />
    <View style={{position:'absolute',top:10,left:10,alignItems:'flex-start',maxWidth:'74%'}} pointerEvents="box-none">
      <MapLayersButton compact />
      {!!historyNote && <Text style={{backgroundColor:'#14191e',color:'#e1d1b6',fontSize:12,padding:4}}>{historyNote}</Text>}
    </View>
    {canStart && <Pressable accessibilityRole="button" onPress={async () => { if (!props.verifyStart || await props.verifyStart()) setActive(true); }} style={styles.startNav}>
      <Text style={styles.startText}>Start Nav</Text>
    </Pressable>}
    {active && <Modal visible animationType="slide" onRequestClose={() => setActive(false)}>
       {props.onDriveStart ? <ActiveRouteNav {...props} fitCoordinates={points} quit={() => setActive(false)} />
        : <RecordedNavigation {...props} fitCoordinates={points} quit={() => setActive(false)} />}
    </Modal>}
  </View>;
}

function navDistance(meters: number) {
  return meters < 160 ? Math.round(meters * 3.28084 / 10) * 10 + ' ft' : (meters / 1609.344).toFixed(1) + ' mi';
}

const navigationBuildId = '96eeadeb-65ad-44a2-89a0-1c7ad12da956';
const navigationBuildPage = 'https://expo.dev/accounts/undergroundvps-team/projects/underground/builds/' + navigationBuildId;
const installManifest = 'https://api.expo.dev/v2/projects/fa7e7c16-cf9d-456b-83c9-4a1c985898c9/builds/' + navigationBuildId + '/manifest.plist';

async function installNavigationUpdate() {
  try {
    await Linking.openURL('itms-services://?action=download-manifest&url=' + encodeURIComponent(installManifest));
  } catch {
    Alert.alert('Installer did not open', 'Open the build page in Safari to install UNDERGROUND.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open build page', onPress: () => void Linking.openURL(navigationBuildPage)
          .catch(() => Alert.alert('Safari could not open the build page.')) },
    ]);
  }
}

type NavigationProps = Props & { fitCoordinates: [number, number][]; quit: () => void };
function RecordedNavigation(props: NavigationProps) {
  const drive = usePersistentDrive();
  const garage = useGarageVehicles();
  const {state} = useSession();
  const member = state.status === 'authenticated' ? state.member : null;
  const cruise = props.resultKind === 'CRUISE';
  const participant = useRef(member);
  const closed = useRef(false);
  const status = drive.state.session.status;
  async function begin() {
    if (drive.recovering || ['recording','paused','interrupted'].includes(status)) {
      throw new Error('Finish your existing trip in the recorder before starting another.');
    }
    if (garage.loading) throw new Error('Your garage is loading. Try again in a moment.');
    if (garage.cars.length > 1 && !garage.selected) throw new Error('Choose a car before starting.');
    participant.current = member;
    if (props.resultKind && !member) throw Error('Sign in to save your result.');
    if (cruise) return true;
    return drive.start({ ...garage.trip, curatedRouteId: props.selectedSlug ?? undefined });
  }
  async function finish(trace: RunFix[], finishMs: number) {
    const route = props.selectedSlug;
    const owner = participant.current;
    if (cruise && owner && route) {
      await saveResult(owner, {kind: 'CRUISE', route});
      return;
    }
    if (!closed.current) {
      await drive.end();
      closed.current = true;
    }
    if (props.resultKind === 'RUN' && owner && route) {
      const duration = finishMs - trace[0]![3];
      if (duration <= 0) throw Error('No valid finish time.');
      await saveResult(owner, {kind:'RUN', route, attempt:drive.state.session.id, duration, trace});
    }
  }
  return <ActiveRouteNav {...props} onRouteComplete={finish} vehicleControl={<GarageVehicleSelect garage={garage}/>}
    elapsedMs={drive.summary?.durationMs} onDriveStart={begin} onDriveFinish={cruise ? undefined : drive.end} interrupted={status === 'interrupted' || status === 'paused'} resumeTrip={drive.resume}/>;
}

function ActiveRouteNav(props: Props & { fitCoordinates: [number, number][]; quit: () => void }) {
  const { fitCoordinates: points, maneuvers, quit } = props;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [controlsOpen, setControlsOpen] = useState(false);
  const { position, status, retry } = useMapLocation(true);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now);
  const [runStarted, setRunStarted] = useState(false);
  const proof = useRef<RunFix[]>([]);
  const [saveState,setSaveState] = useState<'idle'|'saving'|'failed'|'saved'>('idle');
  const startFix = useRef<Fix | null>(null);
  const [showVoices, setShowVoices] = useState(false);
  const activity = props.activity ?? 'Run';
  const [progress, setProgress] = useState(initialProgress);
  const distances = useMemo(() => routeDistances(points), [points]);
  const total = distances[distances.length - 1];
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (runStarted && !props.interrupted && position && position.timestamp >= startedAt.current && status === 'granted') {
      if (props.resultKind === 'RUN' && status === 'granted' && position.accuracyM !== null &&
        position.accuracyM >= 0 && position.accuracyM <= 50 && Date.now() - position.timestamp <= 15000 &&
        position.timestamp > (proof.current[proof.current.length - 1]?.[3] ?? Infinity)) {
        proof.current.push(runFix(position));
      }
      setProgress(previous => advanceRoute(points, distances, previous, position, Date.now(), props.signalGap));
    }
  }, [runStarted, props.interrupted, position, status, points, distances, props.signalGap, props.resultKind]);
  const reliable = status === 'granted' && position && position.timestamp >= startedAt.current &&
    now - position.timestamp < 15000 && position.accuracyM !== null && position.accuracyM >= 0 && position.accuracyM <= 50;
  const here = reliable && position ? position : null;
  const conditionMeters = useMemo(() => conditionPosition(points, distances, here, progress.meters), [points, distances, here, progress.meters]);
  const atStart = !!here && atRouteStart(points[0], here);
  const approach = useApproach(!runStarted && !atStart, here, points[0]);
  const rejoining = runStarted && progress.phase === 'off-route';
  const nextRoadIndex = distances.findIndex(at => at >= progress.meters + 100);
  const rejoin = useApproach(rejoining, here, points[nextRoadIndex < 0 ? points.length - 1 : nextRoadIndex]);
  const leg = rejoining ? rejoin.leg : approach.leg;
  const title = props.navTitle ?? props.badge;
  const approachDistance = leg ? Math.max(0, leg.distances[leg.distances.length - 1] - approach.progress.meters) : null;
  const onSavedRoute = runStarted && !rejoin.leg;
  const turns = onSavedRoute ? maneuvers : leg?.turns;
  const along = onSavedRoute ? progress.meters : rejoining ? rejoin.progress.meters : approach.progress.meters;
  const lengths = onSavedRoute ? distances : leg?.distances;
  const next = lengths && turns?.find(turn => lengths[turn.index] > along + 3);
  const toTurn = next && lengths ? lengths[next.index] - along : 0;
  const turnCue = voiceCue(onSavedRoute ? progress.phase : rejoining ? rejoin.progress.phase : approach.progress.phase, next, toTurn, title, here?.speedMps);
  const departure = !runStarted && leg && along < 40 && leg.turns[0]?.index === 0 ? leg.turns[0].instruction : null;
  let cue = turnCue;
  if (runStarted && !cue && along === 0 && progress.phase === 'following') {
    const first = maneuvers?.[0];
    const instruction = first?.index === 0 ? first.instruction : 'Follow the green route.';
    cue = { key: 'begin-run', text: instruction };
  }
  if (!runStarted) {
    if (atStart) cue = { key: 'meetup', text: "You're at the start. Press Start " + activity + " when you're ready." };
    else if (!leg) cue = { key: 'approach', text: 'Heading to the starting point.' };
    else if (approach.progress.phase === 'off-route') cue = { key: 'approach-off-route', text: 'Updating directions to the meetup.' };
    else if (approach.progress.phase === 'finished') cue = { key: 'approach-end', text: 'Continue to the marked meetup.' };
    else if (turnCue) cue = { key: 'approach-' + turnCue.key, text: turnCue.text };
    else if (departure) cue = { key: 'approach-depart', text: departure };
  }
  if (rejoining && rejoin.leg) {
    cue = turnCue && rejoin.progress.phase === 'following'
      ? { ...turnCue, key: 'rejoin-' + turnCue.key }
      : null;
  }
  const voice = useNavigationVoice(!runStarted || !!maneuvers?.length, !!reliable, cue, onSavedRoute ? points : leg, next?.instruction);
  const starting=useRef(false);
  const finished=useRef(false);
  useEffect(() => {
    if (progress.phase !== 'finished' || finished.current || saveState !== 'idle') return;
    finished.current = true;
    setSaveState('saving');
    const result = props.onRouteComplete ? props.onRouteComplete(proof.current, progress.matchedAt) : props.onDriveFinish?.();
    void Promise.resolve(result).then(() => { proof.current = []; setSaveState('saved'); })
      .catch(() => { finished.current = false; setSaveState('failed'); });
  },[progress.phase,progress.matchedAt,props.onRouteComplete,props.onDriveFinish,saveState]);
  async function startRun() {
    if (!here || Date.now() - here.timestamp >= 15000 || !atRouteStart(points[0], here)) return;
    if(starting.current)return;
    starting.current=true;
    try{
      if(props.onDriveStart && !await props.onDriveStart()){Alert.alert('Recording unavailable','Check location access and retry.');return;}
    } catch (error) { Alert.alert('Unable to start', error instanceof Error ? error.message : 'Please retry.'); return; } finally {starting.current=false;}
    const fix = { ...here, timestamp: Date.now() };
    startFix.current = fix;
    if (props.resultKind === 'RUN') proof.current = [runFix(fix)];
    setProgress({ meters: 0, matchedAt: fix.timestamp, phase: 'following' });
    setRunStarted(true);
  }
  let instruction = next ? navDistance(toTurn) + '  /  ' + next.instruction : 'Follow the green route.';
  if (!runStarted && !next) instruction = leg ? 'Follow the approach to the meetup.' : 'Getting driving directions to the meetup.';
  if (!runStarted && approach.progress.phase === 'off-route' && leg) instruction = 'Updating the approach route.';
  if (!runStarted && approach.error === 'routing') instruction = 'Could not get a driving route. Check your connection and retry.';
  if (!runStarted && approach.error === 'update') instruction = Platform.OS === 'ios' ? 'Install the navigation update for directions to the meetup.' : 'Approach guidance is available on iPhone.';
  if (!runStarted && leg && approach.progress.phase === 'finished') instruction = 'Continue to the marked meetup.';
  if (!runStarted && atStart) instruction = 'Press Start ' + activity + ' when you are ready.';
  if (rejoining && !next) instruction = rejoin.leg ? 'Follow the highlighted road back to the route.' : 'Finding directions back to your route.';
  if (rejoining && !rejoin.leg && rejoin.error) instruction = 'Return directions unavailable. The saved route is shown.';
  if (!reliable) instruction = status === 'denied' ? 'Enable location in Settings to navigate.' : status === 'unavailable' ? 'Location unavailable.' : 'Waiting for a reliable GPS fix.';
  if (progress.phase === 'finished') instruction = 'Route complete.';
  const stage = rejoining ? 'Taking you back to the route' : runStarted ? (progress.phase === 'finished' ? activity + ' complete' : activity + ' in progress')
    : atStart ? 'At the starting point' : 'Taking you to the start';
  const follow = !!here && (runStarted || !!leg);
  return <View style={styles.fill}>
    <TerritorySurface {...props} approachLeg={!!leg} territories={leg ? [] : props.territories}
      fitCoordinates={leg?.points ?? points} streetView={follow} showUserLocation={!!here} followUser={follow}
      userPosition={position} camera={here && follow ? { longitude: here.longitude, latitude: here.latitude, zoom: 16 } : props.camera} />
    <View pointerEvents="box-none" style={[styles.navDock, { bottom: insets.bottom + 8 }]}>
      {(runStarted || atStart) && props.resultKind !== 'CRUISE' && <View pointerEvents="none" style={styles.floatingTime}>
        <RunClock phase={progress.phase === 'finished' ? 'finished' : runStarted ? 'running' : 'ready'}
          elapsedMs={props.resultKind === 'RUN' && startFix.current
            ? Math.max(0, (progress.phase === 'finished' ? progress.matchedAt : now) - startFix.current.timestamp)
            : runStarted ? props.elapsedMs ?? 0 : 0} paused={props.resultKind === 'RUN' ? false : props.interrupted} />
      </View>}
      <View style={[styles.navCard, { maxHeight: Math.max(100, height - insets.top - insets.bottom - 104) }]}>
        <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cardBody}>
          <View style={styles.routeHeading}>
            <Text style={styles.routeTitle}>{title}</Text>
            <Text style={styles.stage}>{stage}</Text>
          </View>
          {props.resultKind === 'CRUISE' && (atStart || progress.phase === 'finished') &&
            <RunClock cruise phase={progress.phase === 'finished' ? 'finished' : 'ready'} elapsedMs={0} />}
          <Text style={styles.guidance}>{instruction}</Text>
          {controlsOpen && <MapLayersButton />}
          {!!props.selectedSlug && progress.phase !== 'finished' &&
            <RouteConditions key={props.selectedSlug} route={props.selectedSlug} fix={here}
              locationMeters={conditionMeters} meters={progress.meters} started={runStarted} now={now} />}
          {!!voice.error && (!runStarted || !!maneuvers?.length) && <Text style={styles.navLabel}>{voice.error}</Text>}
          {rejoining && rejoin.error === 'routing' && <Pressable accessibilityRole="button" style={styles.voiceControl} onPress={rejoin.retry}><Text style={styles.guidance}>Retry return directions</Text></Pressable>}
          {!runStarted && !atStart && approach.error === 'routing' && <Pressable accessibilityRole="button"
            style={styles.voiceControl} onPress={approach.retry}><Text style={styles.guidance}>Retry directions</Text></Pressable>}
          {Platform.OS === 'ios' && (approach.error === 'update' || voice.needsUpdate) && <Pressable accessibilityRole="link"
            style={styles.voiceControl} onPress={() => void installNavigationUpdate()}><Text style={styles.guidance}>Install navigation update</Text></Pressable>}
          {(status === 'denied' || status === 'unavailable') && <Pressable accessibilityRole="button" onPress={() => status === 'denied' ? void Linking.openSettings() : void retry()}>
            <Text style={styles.guidance}>{status === 'denied' ? 'Open settings' : 'Retry GPS'}</Text>
          </Pressable>}
          {saveState === 'failed' && <Pressable accessibilityRole="button" style={styles.begin} onPress={() => setSaveState('idle')}><Text style={styles.startText}>Retry saving finish</Text></Pressable>}
          {saveState === 'saving' && <Text style={styles.navLabel}>Saving finish…</Text>}
          {!runStarted && props.vehicleControl}
          {runStarted && props.interrupted && <Pressable accessibilityRole="button" style={styles.begin} onPress={() => void props.resumeTrip?.()}><Text style={styles.startText}>Resume recording</Text></Pressable>}
          {!runStarted && atStart && <Pressable accessibilityRole="button" style={styles.begin} onPress={startRun}><Text style={styles.startText}>Start {activity}</Text></Pressable>}
          <Pressable accessibilityRole="button" accessibilityHint="Toggle navigation controls" accessibilityState={{ expanded: controlsOpen }}
            style={styles.progressRow} onPress={() => setControlsOpen(open => !open)}>
            {runStarted ? <Text style={styles.progressText}>{Math.min(progress.phase === 'finished' ? 100 : 99, Math.floor(100 * progress.meters / (total || 1)))}%   /   {navDistance(Math.max(0,total - progress.meters))} remaining</Text>
              : <Text style={styles.navLabel}>{atStart ? 'At the start' : approachDistance === null ? activity + ' has not started' : navDistance(approachDistance) + ' to the start'}</Text>}
            <View accessible={false} style={[styles.chevron, controlsOpen && styles.chevronOpen]} />
          </Pressable>
          {controlsOpen && <View style={styles.controls}>
            {(!runStarted || !!maneuvers?.length) && <>
              {voice.ready && <View style={styles.voiceControls}>
                <Pressable accessibilityRole="button" style={styles.voiceControl} onPress={voice.toggle}>
                  <Text style={styles.navLabel}>{voice.muted ? 'Unmute voice' : 'Mute voice'}</Text>
                </Pressable>
                {voice.voices.length > 0 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: showVoices }} style={styles.voiceControl} onPress={() => setShowVoices(!showVoices)}>
                  <Text style={styles.navLabel}>Choose voice</Text>
                </Pressable>}
                <Pressable accessibilityRole="button" style={styles.voiceControl} onPress={voice.test}>
                  <Text style={styles.navLabel}>Test voice</Text>
                </Pressable>
              </View>}
              {voice.ready && showVoices && <ScrollView nestedScrollEnabled style={{ maxHeight: 152 }} keyboardShouldPersistTaps="handled">
                {voice.voices.every(v => qualityLabel(v) === 'Standard') && Platform.OS === 'ios' && <Text style={styles.navLabel}>More natural voices are available to download in iPhone Accessibility settings. Choose an English (UK) Enhanced or Premium voice.</Text>}
                {voice.voices.map(v => <Pressable key={v.identifier} accessibilityRole="radio" accessibilityState={{ checked: voice.selected === v.identifier }}
                  style={styles.voiceControl} onPress={() => voice.choose(v.identifier)}>
                  <Text style={styles.guidance}>{voice.selected === v.identifier ? '✓ ' : ''}{v.name} · {qualityLabel(v)}</Text>
                </Pressable>)}
              </ScrollView>}
            </>}
            <Text style={styles.navLabel}>Keep the app open for GPS tracking.</Text>
            <Pressable accessibilityRole="button" style={styles.quitNav} onPress={() => {
              if (saveState === 'saving') return;
              if (progress.phase === 'finished' && saveState === 'failed') {
                Alert.alert('Finish not saved', 'Retry saving before leaving.', [{text:'Stay'}, {text:'Leave', onPress:quit}]);
                return;
              }
              if (!runStarted || finished.current) { quit(); return; }
              if (props.resultKind === 'CRUISE') {
                Alert.alert('Leave Cruise?', 'This Cruise will remain incomplete.', [{text:'Keep cruising'}, {text:'Leave', onPress:quit}]);
                return;
              }
              Alert.alert('End this drive?', 'Your trip so far will be saved.', [
                { text: 'Keep driving', style: 'cancel' },
                { text: 'End and save', onPress: async () => { await props.onDriveFinish?.(); quit(); } },
              ]);
            }}><Text style={styles.guidance}>Quit Nav</Text></Pressable>
          </View>}
        </ScrollView>
      </View>
    </View>
    {runStarted && progress.phase === 'finished' && <FinishBanner />}
  </View>;
}

function TerritorySurface({
  territories,
  selectedSlug,
  onSelect,
  camera,
  badge,
  forceFallback,
  onExploreRoute,
  showTerritories = true,
  onPan,
  followUser = false,
  showUserLocation = false,
  userPosition = null,
  cameraRevision = 0,
  fitCoordinates,
  approachLeg = false,
  historyZones,
  streetView,
}: Props) {
  const { lighting, reportCenter } = useMapLighting(camera);
  const settings=useLayers();
  const [view,setView]=useState<Box | null>(null);
  const pins=useMemo(()=>cameraPins(settings.plate || settings.speed ? snapshot() : null,view,settings),[settings,view]);
  const historyLines=useMemo(()=>!approachLeg && fitCoordinates && historyZones ? drawZones(fitCoordinates,historyZones) : [],[approachLeg,fitCoordinates,historyZones]);
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
        SymbolLayer: api.SymbolLayer,
        FillExtrusionLayer: api.FillExtrusionLayer,
        BackgroundLayer: api.BackgroundLayer,
        MarkerView: api.MarkerView, RasterLayer: api.RasterLayer, RasterSource: api.RasterSource,
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
  const endpoints = fitCoordinates?.length ? { start: fitCoordinates[0], finish: fitCoordinates[fitCoordinates.length - 1] } : selected ? startFinishForTerritory(selected) : null;

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
        historyLines={historyLines}
        lighting={lighting}
        onCenterChange={reportCenter}
        territories={territories}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        camera={camera}
        badge={badge ? `${badge} · APPLE MAP FALLBACK` : ''}
        onExploreRoute={onExploreRoute}
        showTerritories={showTerritories}
        onPan={onPan}
        followUser={followUser}
        showUserLocation={showUserLocation}
        userPosition={userPosition}
        cameraRevision={cameraRevision}
        streetView={streetView}
        approachLeg={approachLeg}
        fitCoordinates={fitCoordinates}
      />
    );
  }

  if (load.status === 'fallback' || !MapboxMod) {
    return (
      <WorldMapFallback
        historyLines={historyLines}
        lighting={lighting}
        onCenterChange={reportCenter}
        territories={territories}
        selectedSlug={selectedSlug}
        onSelect={onSelect}
        camera={camera}
        badge={badge}
        onExploreRoute={onExploreRoute}
        showTerritories={showTerritories}
        onPan={onPan}
        followUser={followUser}
        showUserLocation={showUserLocation}
        userPosition={userPosition}
        cameraRevision={cameraRevision}
        streetView={streetView}
        approachLeg={approachLeg}
        fitCoordinates={fitCoordinates}
      />
    );
  }

  const { MapView, Camera, ShapeSource, LineLayer, CircleLayer, SymbolLayer, FillExtrusionLayer, MarkerView, RasterLayer, RasterSource, UserLocation } = MapboxMod;
  const bounds = !streetView && fitCoordinates?.length ? { ne: [Math.max(...fitCoordinates.map(p => p[0])), Math.max(...fitCoordinates.map(p => p[1]))], sw: [Math.min(...fitCoordinates.map(p => p[0])), Math.min(...fitCoordinates.map(p => p[1]))], paddingTop: 75, paddingBottom: 75, paddingLeft: 55, paddingRight: 55 } : undefined;

  return (
    <View style={styles.fill}>
      <MapView
        style={styles.fill}
        styleURL="mapbox://styles/mapbox/dark-v11"
        onMapIdle={(event: { properties: { center: number[]; bounds?:{sw:number[];ne:number[]} } }) => {
          const bounds=event.properties.bounds;
          if(bounds) {
            const next={west:bounds.sw[0]!,south:bounds.sw[1]!,east:bounds.ne[0]!,north:bounds.ne[1]!};
            setView(old=>old && Math.abs(old.west-next.west)<0.00001 && Math.abs(old.east-next.east)<0.00001 &&
              Math.abs(old.north-next.north)<0.00001 && Math.abs(old.south-next.south)<0.00001 ? old : next);
          }
          const [longitude, latitude] = event.properties.center;
          reportCenter({ longitude, latitude });
        }}
        onCameraChanged={(event: { gestures?: { isGestureActive?: boolean } }) => { if (event.gestures?.isGestureActive) onPan?.(); }}
        logoEnabled
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
          followUserLocation={followUser}
          followZoomLevel={camera.zoom}
          followPitch={42}
          pitch={42}
          bounds={bounds}
          centerCoordinate={bounds ? undefined : [camera.longitude, camera.latitude]}
          zoomLevel={bounds ? undefined : camera.zoom}
          animationMode="flyTo"
          animationDuration={600}
        />
        {RasterSource && RasterLayer ? (
          <RasterSource id="satellite-imagery" url="mapbox://mapbox.satellite" tileSize={256}>
            <RasterLayer id="tactical-satellite" belowLayerID="road-label"
              style={{ rasterBrightnessMax: 0.59 + 0.16 * lighting.daylight, rasterSaturation: -0.18 }} />
          </RasterSource>
        ) : null}
        {!fitCoordinates && !showTerritories && MarkerView ? <MarkerView coordinate={[campusPoint.longitude, campusPoint.latitude]} anchor={beaconAnchor} allowOverlap>
          <MapBeacon label="NVIDIA Campus" />
        </MarkerView> : null}
        {!fitCoordinates && showUserLocation && userPosition && MarkerView ? <MarkerView coordinate={[userPosition.longitude, userPosition.latitude]} anchor={locationAnchor} allowOverlap allowOverlapWithPuck>
          <MapBeacon location label="You" />
        </MarkerView> : null}
        {FillExtrusionLayer ? <FillExtrusionLayer id="night-buildings" sourceID="composite" sourceLayerID="building" minZoomLevel={14}
          style={{ fillExtrusionColor: '#354858', fillExtrusionOpacity: 0.84 - 0.62 * lighting.daylight, fillExtrusionHeight: ['coalesce', ['get', 'height'], 5] }} /> : null}
        {<LineLayer id="night-arterials" sourceID="composite" sourceLayerID="road" minZoomLevel={13}
          filter={['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false]}
          style={{ lineColor: '#DF924F', lineWidth: 2, lineOpacity: 0.8 }} />}
        {showUserLocation && UserLocation ? <UserLocation visible={!!fitCoordinates || !MarkerView || !userPosition} /> : null}
        {historyLines.length > 0 && <ShapeSource id="historical-checks" shape={{type:'FeatureCollection',features:historyLines.map(z=>({
          type:'Feature',properties:{detail:zoneLabel(z)},geometry:{type:'LineString',coordinates:z.coords}}))}}
          onPress={(e:{features?:{properties?:{detail?:string}}[]})=>Alert.alert('Recurring speed checks',e.features?.[0]?.properties?.detail)}>
          <LineLayer id="historical-check-segments" style={{lineColor:'#B89356',lineWidth:13,lineOpacity:0.76,lineCap:'round'}}/>
        </ShapeSource>}
        {pins.length > 0 && <ShapeSource id="ca-cameras" hitbox={{width:24,height:24}}
          shape={{type:'FeatureCollection',features:pins.map(p=>({type:'Feature',id:p.id,properties:{kind:p.kind,title:p.title,detail:p.detail},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))}}
          onPress={(e:{features?:{properties?:{title?:string;detail?:string}}[]})=>{const p=e.features?.[0]?.properties;if(p)Alert.alert(p.title || 'Camera',p.detail);}}>
          <CircleLayer id="ca-camera-dots" minZoomLevel={12} style={{circleColor:['match',['get','kind'],'speed','#CFA868','#90A5B5'],circleRadius:4,circleStrokeWidth:1,circleStrokeColor:'#151B22'}}/>
        </ShapeSource>}
        {onExploreRoute && <ShapeSource id="explore-drives" shape={exploreRoutes} hitbox={{ width: 22, height: 22 }}
          onPress={(event: { features?: Array<{ properties?: { slug?: string } }> }) => {
            const slug = event.features?.[0]?.properties?.slug;
            if (slug) onExploreRoute(slug);
          }}>
          <LineLayer id="explore-drive-outline" style={{ lineColor: '#173510', lineWidth: 7, lineJoin: 'round' }} />
          <LineLayer id="explore-drive-line" style={{ lineColor: '#76FF03', lineWidth: 4, lineJoin: 'round' }} />
          <SymbolLayer id="explore-drive-name" minZoomLevel={10} style={{
            symbolPlacement: 'line', textField: ['get', 'name'], textSize: 13,
            textColor: '#EDFFDF', textHaloColor: '#10200B', textHaloWidth: 2,
          }} />
        </ShapeSource>}
        {showTerritories ? <ShapeSource
          id="territories"
          shape={fitCoordinates ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: fitCoordinates } } : collection}
          onPress={(event: { features?: Array<{ properties?: { slug?: string } }> }) => {
            const slug = event?.features?.[0]?.properties?.slug;
            if (slug) onSelect(slug);
          }}
        >
          {fitCoordinates ? <LineLayer id="route-glow" style={{ lineColor: '#76FF03', lineWidth: 20, lineOpacity: 0.35, lineBlur: 7 }} /> : null}
          {fitCoordinates ? <LineLayer id="route-neon" style={{ lineColor: '#76FF03', lineWidth: 8, lineOpacity: 1 }} /> : null}
          <LineLayer
            id="territory-lines"
            style={{
              lineColor: fitCoordinates ? '#E9FFD5' : [
                'case',
                ['get', 'selected'],
                shell.accent,
                'rgba(197,165,114,0.45)',
              ],
              lineWidth: fitCoordinates ? 3 : ['case', ['get', 'selected'], 5, 2.5],
              lineOpacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource> : null}
        {fitCoordinates && endpoints && MarkerView ? (
          <>
            {!approachLeg && <MarkerView coordinate={endpoints.start} anchor={beaconAnchor} allowOverlap><MapBeacon label={endpoints.start.every((v, i) => v === endpoints.finish[i]) ? 'START / FINISH' : 'START'} /></MarkerView>}
            {endpoints.start.some((v, i) => v !== endpoints.finish[i]) && <MarkerView coordinate={endpoints.finish} anchor={beaconAnchor} allowOverlap><MapBeacon label={approachLeg ? 'MEETUP' : 'FINISH'} /></MarkerView>}
          </>
        ) : showTerritories && endpoints ? (
          <ShapeSource
            id="endpoints"
            shape={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { role: 'start', label: endpoints.start.every((v, i) => v === endpoints.finish[i]) ? 'START / FINISH' : 'START' },
                  geometry: { type: 'Point', coordinates: endpoints.start },
                },
                {
                  type: 'Feature',
                  properties: { role: 'finish', label: endpoints.start.every((v, i) => v === endpoints.finish[i]) ? '' : 'FINISH' },
                  geometry: { type: 'Point', coordinates: endpoints.finish },
                },
              ].filter(feature => feature.properties.label !== ''),
            }}
          >
            <SymbolLayer id="endpoint-labels" style={{ textField: ['get', 'label'], textSize: 13, textColor: '#FFFFFF', textHaloColor: '#08090A', textHaloWidth: 2, textOffset: [0, -1.8], textAllowOverlap: true }} />
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
      {(settings.plate || settings.speed) && <View pointerEvents="none" style={{position:'absolute',left:8,bottom:26}}><Text style={{fontSize:9,color:'#ddd',backgroundColor:'#131a22'}}>© OpenStreetMap contributors · CA city data</Text></View>}
      {!!badge && !fitCoordinates && <View style={styles.badge} pointerEvents="none">
        <Text variant="caption" gold>
          {badge}
        </Text>
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  begin: { backgroundColor: '#A1F572', alignItems: 'center', padding: 14, borderRadius: 6 },
  voiceControls: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  voiceControl: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  startNav: { position: 'absolute', bottom: 24, right: 12, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 6, backgroundColor: '#A1F572' },
  startText: { color: '#091308', fontSize: 17, fontFamily: 'BarlowCondensed_700Bold' },
  navDock: { position: 'absolute', left: 12, right: 12, gap: 5 },
  floatingTime: { alignItems: 'center', paddingVertical: 3 },
  navCard: { flexShrink: 1, borderRadius: 10, backgroundColor: '#091116F2', borderWidth: StyleSheet.hairlineWidth, borderColor: '#415451', overflow: 'hidden' },
  cardBody: { paddingHorizontal: 15, paddingTop: 12, paddingBottom: 3, gap: 5 },
  routeHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  routeTitle: { fontFamily: 'DMSans_600SemiBold', color: '#D6E0DA', fontSize: 14 },
  stage: { color: '#B6E9A1', fontSize: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#364740', marginTop: 2 },
  progressText: { fontFamily: 'DMSans_500Medium', color: '#E4EDE6', fontSize: 14, flexShrink: 1 },
  chevron: { width: 9, height: 9, borderColor: '#BBCCBD', borderTopWidth: 1.5, borderLeftWidth: 1.5, transform: [{rotate: '45deg'}], marginRight: 3 },
  chevronOpen: { transform: [{rotate: '-135deg'}] },
  controls: { gap: 6, paddingBottom: 9 },
  guidance: { color: '#FFFFFF', fontSize: 20, fontFamily: 'BarlowCondensed_700Bold' },
  navLabel: { color: '#ACCAD0', fontSize: 13 },
  quitNav: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderColor: '#607680', borderWidth: 1, borderRadius: 5 },
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
