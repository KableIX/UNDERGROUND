import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { draftMontereyTerritories } from '../data/monterey-draft';
import {
  siliconValleyDevTerritories,
  siliconValleyDistrict,
} from '../data/silicon-valley-dev';
import { previewChallenge } from '../lib/challenge';
import { appendSimNewswireStory, runSimCaptureWorkflow } from '../lib/sim-workflow';
import { MONTEREY_CAMERA, SV_DEV_CAMERA } from '../lib/mapbox-static';
import { shell } from '../theme/shell';
import { TacticalMapPlane } from './TacticalMapPlane';

type Track = 'solo' | 'club';
type DistrictMode = 'monterey' | 'silicon-valley-dev';

/**
 * Interactive Conquest map shell.
 * Monterey = production_candidate (draft). Silicon Valley = development only.
 * Dev routes never write production ownership (engine + district gate).
 * Production captures stay disabled until geometry/verification validated.
 */
export function ConquestMap() {
  const [district, setDistrict] = useState<DistrictMode>('silicon-valley-dev');
  const [track, setTrack] = useState<Track>('solo');
  const territories =
    district === 'silicon-valley-dev' ? siliconValleyDevTerritories : draftMontereyTerritories;
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    siliconValleyDevTerritories[0]?.slug ?? null,
  );
  const [lastPreview, setLastPreview] = useState<string>('No challenge preview yet.');

  const selected = useMemo(
    () => territories.find((t) => t.slug === selectedSlug) ?? null,
    [territories, selectedSlug],
  );

  const isDevDistrict = district === 'silicon-valley-dev';
  const camera = isDevDistrict ? SV_DEV_CAMERA : MONTEREY_CAMERA;

  function switchDistrict(next: DistrictMode) {
    setDistrict(next);
    const list = next === 'silicon-valley-dev' ? siliconValleyDevTerritories : draftMontereyTerritories;
    setSelectedSlug(list[0]?.slug ?? null);
    setLastPreview('No challenge preview yet.');
  }

  function onChallenge(isSimulation: boolean) {
    if (!selected) return;

    // Production captures hard-blocked for draft Monterey + all development districts.
    if (!isSimulation) {
      setLastPreview(
        isDevDistrict
          ? 'BLOCKED (development_district) · DEV ROUTES NEVER PRODUCTION-CAPTURABLE'
          : 'BLOCKED (draft_territory / geometry unverified) · PRODUCTION CAPTURES DISABLED',
      );
      return;
    }

    // Sim workflow: SV DEV only for captures → Newswire (hard-gated).
    if (!isDevDistrict) {
      setLastPreview('SIM CAPTURES LIMITED TO SILICON VALLEY DEV DISTRICT');
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
      setLastPreview(`SIM BLOCKED (${workflow.error})`);
      return;
    }

    appendSimNewswireStory(workflow.story);

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
    setLastPreview(
      `SIM → NEWSWIRE · ${workflow.story.headline} · ownershipWrite=false${engineNote}`,
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.mapPlane}>
        <TacticalMapPlane
          territories={territories}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
          camera={camera}
          illuminated
          badge={
            isDevDistrict
              ? `${siliconValleyDistrict.name.toUpperCase()} · DEV ONLY`
              : 'MONTEREY · PRODUCTION CANDIDATE (DRAFT)'
          }
          disclaimer={
            isDevDistrict
              ? 'SANTA CLARA TEST ROUTES — NEVER PRODUCTION OWNERSHIP · SIM → NEWSWIRE ONLY'
              : 'PLACEHOLDER LINESTRINGS — PRODUCTION CAPTURES DISABLED UNTIL GEOMETRY VALIDATED'
          }
        />
      </View>

      <View style={styles.panel}>
        <View style={styles.modes}>
          <ModeChip
            label="SV DEV"
            active={district === 'silicon-valley-dev'}
            onPress={() => switchDistrict('silicon-valley-dev')}
          />
          <ModeChip
            label="MONTEREY"
            active={district === 'monterey'}
            onPress={() => switchDistrict('monterey')}
          />
        </View>
        <View style={styles.modes}>
          <ModeChip label="SOLO" active={track === 'solo'} onPress={() => setTrack('solo')} />
          <ModeChip label="CLUB" active={track === 'club'} onPress={() => setTrack('club')} />
        </View>
        <Text variant="title" gold>
          {selected?.name ?? 'Select a territory'}
        </Text>
        <Text variant="caption" style={styles.meta}>
          {isDevDistrict ? 'KIND DEVELOPMENT' : 'KIND PRODUCTION_CANDIDATE'} · STATUS{' '}
          {selected?.status.toUpperCase() ?? '—'} · TRACK {track.toUpperCase()} · WEIGHT{' '}
          {selected?.eligibleWeight ?? '—'}
        </Text>
        <Text style={styles.body}>
          {isDevDistrict
            ? 'Development district for Santa Clara test loops. Production capture actions are hard-blocked in UI and engine. Use SIM CAPTURE to publish a sim Newswire story.'
            : 'Monterey remains a production candidate with draft geometries. Production captures stay blocked while status=draft / unverified.'}
        </Text>
        <Text variant="caption" style={styles.preview}>
          {lastPreview}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.cta} onPress={() => onChallenge(false)}>
            <Text variant="caption" gold>
              PROD CAPTURE (BLOCKED)
            </Text>
          </Pressable>
          <Pressable style={styles.ctaMuted} onPress={() => onChallenge(true)}>
            <Text variant="caption" gold>
              {isDevDistrict ? 'SIM CAPTURE → NEWSWIRE' : 'SIM (SV DEV ONLY)'}
            </Text>
          </Pressable>
        </View>
      </View>
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
  },
  mapPlane: {
    flex: 1.35,
    backgroundColor: shell.mapVoid,
    overflow: 'hidden',
    minHeight: 260,
  },
  panel: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: shell.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(197,165,114,0.3)',
  },
  modes: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
  chipActive: {
    borderColor: shell.accent,
  },
  meta: {
    marginTop: 8,
    color: shell.muted,
  },
  body: {
    marginTop: 10,
    color: shell.muted,
  },
  preview: {
    marginTop: 12,
    color: shell.accent,
  },
  actions: {
    marginTop: 16,
    gap: 10,
  },
  cta: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  ctaMuted: {
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
});
