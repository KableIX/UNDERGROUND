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

type Track = 'solo' | 'club';
type DistrictMode = 'monterey' | 'silicon-valley-dev';

/**
 * Conquest v2 — map-first tactical command surface.
 * SV DEV default; Monterey = production_candidate DRAFT.
 * Production captures blocked; sim → Newswire only on SV DEV (no CLOUT / ownership).
 */
export function ConquestMap() {
  const insets = useSafeAreaInsets();
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
  const camera = isDevDistrict ? SV_LANDMARK_CAMERA : MONTEREY_LANDMARK_CAMERA;

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
        </View>
      </View>

      <View style={styles.map}>
        <MapboxTerritoryMap
          territories={territories}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
          camera={camera}
          badge={
            isDevDistrict
              ? `${siliconValleyDistrict.name.toUpperCase()} · DEV`
              : 'MONTEREY · DRAFT CANDIDATE'
          }
        />
      </View>

      <ConquestBottomSheet
        territory={selected}
        districtLabel={isDevDistrict ? 'SILICON VALLEY' : 'MONTEREY'}
        districtKind={isDevDistrict ? 'development' : 'production_candidate'}
        track={track}
        onTrackChange={setTrack}
        ownershipLabel="Ownership — unclaimed (sim never writes production ledgers)"
        previewMessage={previewMessage}
        onProdChallenge={onProdChallenge}
        onSimCapture={onSimCapture}
      />
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
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
