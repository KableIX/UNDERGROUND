import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { buildSimGpsReplay, checkpointsAlongReplay } from '@underground/territory-engine';
import { Text } from '@underground/ui';
import { ConquestBottomSheet } from './conquest/ConquestBottomSheet';
import { MapboxTerritoryMap } from './conquest/MapboxTerritoryMap';
import { draftMontereyTerritories } from '../data/monterey-draft';
import {
  siliconValleyDevTerritories,
  siliconValleyDistrict,
} from '../data/silicon-valley-dev';
import {
  MONTEREY_LANDMARK_CAMERA,
  SV_LANDMARK_CAMERA,
} from '../data/landmarks';
import { previewChallenge } from '../lib/challenge';
import { appendSimNewswireStory, runSimCaptureWorkflow } from '../lib/sim-workflow';
import { shell } from '../theme/shell';
import { useForegroundDrive } from '../lib/foreground-drive';

type MapMode = 'explore' | 'drive' | 'conquest';
type Track = 'solo' | 'club';
type DistrictMode = 'monterey' | 'silicon-valley-dev';

/**
 * Conquest v2 — map-first tactical command surface.
 * SV DEV default; Monterey = production_candidate DRAFT.
 * Production captures blocked; sim → Newswire only on SV DEV (no CLOUT / ownership).
 */
export function ConquestMap() {
  const insets = useSafeAreaInsets();
  const drive = useForegroundDrive();
  const [mapMode, setMapMode] = useState<MapMode>('explore');
  const [district, setDistrict] = useState<DistrictMode>('silicon-valley-dev');
  const [track, setTrack] = useState<Track>('solo');
  const territories =
    district === 'silicon-valley-dev' ? siliconValleyDevTerritories : draftMontereyTerritories;
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    siliconValleyDevTerritories[0]?.slug ?? null,
  );
  const [previewMessage, setPreviewMessage] = useState(
    'Select a route. Production captures disabled.',
  );

  const selected = useMemo(
    () => territories.find((t) => t.slug === selectedSlug) ?? null,
    [territories, selectedSlug],
  );

  const isDevDistrict = district === 'silicon-valley-dev';
  const districtCamera = isDevDistrict ? SV_LANDMARK_CAMERA : MONTEREY_LANDMARK_CAMERA;
  const camera = mapMode === 'drive' && drive.currentPosition
    ? { longitude: drive.currentPosition.longitude, latitude: drive.currentPosition.latitude, zoom: 14 }
    : districtCamera;
  const showTerritories = mapMode === 'conquest';


  function switchMapMode(next: MapMode) {
    if (mapMode === 'drive' && next !== 'drive' && drive.status === 'recording') {
      drive.pause();
    }
    setMapMode(next);
  }

  function switchDistrict(next: DistrictMode) {
    setDistrict(next);
    const list = next === 'silicon-valley-dev' ? siliconValleyDevTerritories : draftMontereyTerritories;
    setSelectedSlug(list[0]?.slug ?? null);
    setPreviewMessage('Select a route. Production captures disabled.');
  }

  function onProdChallenge() {
    if (!selected) return;
    setPreviewMessage(
      isDevDistrict
        ? 'Blocked — development district cannot take production ownership.'
        : 'Blocked — draft geometry / production captures disabled.',
    );
  }

  function onSimCapture() {
    if (!selected) return;

    if (!isDevDistrict) {
      setPreviewMessage('Sim captures limited to Silicon Valley DEV.');
      return;
    }

    const workflow = runSimCaptureWorkflow({
      territory: selected,
      track,
      challengerId: '33333333-3333-4333-8333-333333333301',
      displayName: 'STARK',
      points: 10,
    });

    if (!workflow.ok) {
      setPreviewMessage(`Sim blocked (${workflow.error}).`);
      return;
    }

    appendSimNewswireStory(workflow.story);

    const replay = buildSimGpsReplay({
      territorySlug: selected.slug,
      coordinates: selected.geometry.coordinates as [number, number][],
      startMs: Date.now(),
      stepMs: 1000,
    });
    const cps = checkpointsAlongReplay(replay, 1);

    const preview = previewChallenge({
      territoryDefinitionId: selected.id,
      track,
      challengerId: 'local-preview-member',
      points: 10,
      isSimulation: true,
      districtSlug: selected.districtSlug,
      territories,
    });
    const engineNote =
      preview.capture.ok === false ? ` · engine ${preview.capture.error}` : '';

    setPreviewMessage(
      `Sim → Newswire · ${cps.length} checkpoints · ownership locked · CLOUT +0${engineNote}`,
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        <Text variant="brand" gold>
          UNDERGROUND
        </Text>
        <View style={styles.modes}>
          <ModeChip label="EXPLORE" active={mapMode === 'explore'} onPress={() => switchMapMode('explore')} />
          <ModeChip label="DRIVE" active={mapMode === 'drive'} onPress={() => switchMapMode('drive')} />
          <ModeChip label="CONQUEST" active={mapMode === 'conquest'} onPress={() => switchMapMode('conquest')} />
        </View>
        {showTerritories ? <View style={styles.districtModes}>
          <ModeChip
            label="SV"
            active={district === 'silicon-valley-dev'}
            onPress={() => switchDistrict('silicon-valley-dev')}
          />
          <ModeChip
            label="MONTEREY"
            active={district === 'monterey'}
            onPress={() => switchDistrict('monterey')}
          />
        </View> : null}
      </View>

      <View style={styles.map}>
        <MapboxTerritoryMap
          territories={territories}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
          camera={camera}
          showTerritories={showTerritories}
          followUser={mapMode === 'drive' && drive.status === 'recording'}
          badge={
            mapMode === 'explore' ? 'EXPLORE · WORLD MAP'
              : mapMode === 'drive' ? 'DRIVE · PRIVATE GPS'
                : isDevDistrict ? `${siliconValleyDistrict.name.toUpperCase()} · DEV`
                  : 'MONTEREY · DRAFT CANDIDATE'
          }
        />
      </View>

      {mapMode === 'explore' ? (
        <View style={styles.modePanel}>
          <Text variant="caption" gold>EXPLORE · FULL WORLD MAP</Text>
          <Text style={styles.modeInfo}>Pan, zoom and navigate anywhere. Territories are curated overlays, not limits on the map.</Text>
          <Pressable style={styles.modeButton} onPress={() => switchMapMode('conquest')}>
            <Text variant="caption" gold>VIEW TERRITORIES</Text>
          </Pressable>
        </View>
      ) : null}

      {mapMode === 'drive' ? (
        <View style={styles.modePanel}>
          <Text variant="caption" gold>DRIVE · PRIVATE TRIP</Text>
          <Text style={styles.modeInfo}>GPS {drive.status.toUpperCase()} · {drive.points} fixes · {drive.accuracyM == null ? 'NO FIX' : `${Math.round(drive.accuracyM)}m ACCURACY`}</Text>
          <Text variant="title" gold>{(drive.distanceM / 1609.344).toFixed(2)} mi · {Math.floor(drive.elapsedSeconds / 60)}:{String(drive.elapsedSeconds % 60).padStart(2, '0')}</Text>
          <Text style={styles.modeInfo}>Foreground recording only. Not persisted or eligible for territory awards.</Text>
          <View style={styles.driveActions}>
            {drive.status !== 'recording' ? <Pressable style={styles.modeButton} onPress={() => void drive.start()}><Text variant="caption" gold>{drive.status === 'paused' ? 'RESUME' : 'START DRIVE'}</Text></Pressable> : <Pressable style={styles.modeButton} onPress={drive.pause}><Text variant="caption" gold>PAUSE</Text></Pressable>}
            <Pressable style={styles.modeButton} onPress={drive.finish}><Text variant="caption" gold>END</Text></Pressable>
          </View>
        </View>
      ) : null}

      {mapMode === 'conquest' ? <ConquestBottomSheet
        territory={selected}
        districtLabel={isDevDistrict ? 'SILICON VALLEY' : 'MONTEREY'}
        districtKind={isDevDistrict ? 'development' : 'production_candidate'}
        track={track}
        onTrackChange={setTrack}
        ownershipLabel="Ownership — unclaimed (sim never writes production ledgers)"
        previewMessage={previewMessage}
        onProdChallenge={onProdChallenge}
        onSimCapture={onSimCapture}
      /> : null}
    </View>
  );
}

function ModeChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text variant="caption" gold={active} style={!active ? { color: shell.muted } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: shell.mapVoid,
  },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: 12, paddingBottom: 8,
    alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(5,7,12,0.83)',
  },
  districtModes: { flexDirection: 'row', gap: 8 },
  modePanel: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(5,7,12,0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: shell.accent,
    gap: 8,
  },
  modeInfo: { color: shell.muted },
  driveActions: { flexDirection: 'row', gap: 12 },
  modeButton: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
    paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent, flex: 1,
  },
  modes: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    backgroundColor: 'rgba(5,7,12,0.65)',
  },
  chipActive: {
    borderColor: shell.accent,
  },
  map: {
    flex: 1,
  },
});
