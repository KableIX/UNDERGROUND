import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { draftMontereyTerritories } from '../data/monterey-draft';
import {
  siliconValleyDevTerritories,
  siliconValleyDistrict,
} from '../data/silicon-valley-dev';
import { previewChallenge } from '../lib/challenge';
import { mapboxConfigured } from '../lib/env';
import { shell } from '../theme/shell';

type Track = 'solo' | 'club';
type DistrictMode = 'monterey' | 'silicon-valley-dev';

/**
 * Interactive Conquest map shell.
 * Monterey = production_candidate (draft). Silicon Valley = development only.
 * Dev routes never write production ownership (engine + district gate).
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

  function switchDistrict(next: DistrictMode) {
    setDistrict(next);
    const list = next === 'silicon-valley-dev' ? siliconValleyDevTerritories : draftMontereyTerritories;
    setSelectedSlug(list[0]?.slug ?? null);
    setLastPreview('No challenge preview yet.');
  }

  function onChallenge(isSimulation: boolean) {
    if (!selected) return;
    if (isDevDistrict && !isSimulation) {
      setLastPreview('BLOCKED (development_district) · DEV ROUTES NEVER PRODUCTION-CAPTURABLE');
      return;
    }
    const preview = previewChallenge({
      territoryDefinitionId: selected.id,
      track,
      challengerId: 'local-preview-member',
      points: 10,
      isSimulation,
    });
    if (!preview.capture.ok) {
      setLastPreview(
        `BLOCKED (${preview.capture.error}) · crown ${
          preview.crown.isNeutral ? 'NEUTRAL' : preview.crown.crownOwnerId
        }`,
      );
      return;
    }
    setLastPreview(
      `${preview.capture.kind.toUpperCase()} · owner ${preview.capture.ownerId} · crown ${
        preview.crown.isNeutral ? 'NEUTRAL' : preview.crown.crownOwnerId
      }`,
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.mapPlane, isDevDistrict && styles.mapPlaneDev]}>
        <View style={[styles.atmosphere, isDevDistrict && styles.atmosphereDev]} />
        <Text variant="caption" gold style={styles.mapBadge}>
          {isDevDistrict
            ? `${siliconValleyDistrict.name.toUpperCase()} · DEV ONLY`
            : mapboxConfigured
              ? 'MONTEREY · SATELLITE LAYER'
              : 'MONTEREY · DARK FALLBACK · NO MAPBOX TOKEN'}
        </Text>
        <View style={styles.routes}>
          {territories.map((territory, index) => {
            const active = territory.slug === selectedSlug;
            return (
              <Pressable
                key={territory.id}
                onPress={() => setSelectedSlug(territory.slug)}
                style={[
                  styles.route,
                  {
                    top: 36 + index * 42,
                    opacity: active ? 1 : 0.55,
                    shadowOpacity: active ? 0.9 : 0.35,
                  },
                ]}
              >
                <View style={[styles.node, active && styles.nodeActive]} />
                <View style={[styles.line, active && styles.lineActive, isDevDistrict && styles.lineDev]} />
                <Text variant="caption" style={styles.routeLabel}>
                  {territory.name.toUpperCase()} · {isDevDistrict ? 'DEV' : 'DRAFT'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" style={styles.disclaimer}>
          {isDevDistrict
            ? 'SANTA CLARA TEST ROUTES — NEVER PRODUCTION OWNERSHIP'
            : 'PLACEHOLDER LINESTRINGS — NOT PRODUCTION ROAD GEOMETRY'}
        </Text>
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
            ? 'Development district for Santa Clara test loops. Production capture actions are hard-blocked in UI and engine.'
            : 'Monterey remains a production candidate with draft geometries. Production captures stay blocked while status=draft.'}
        </Text>
        <Text variant="caption" style={styles.preview}>
          {lastPreview}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.cta} onPress={() => onChallenge(false)}>
            <Text variant="caption" gold>
              {isDevDistrict ? 'PROD CAPTURE (BLOCKED)' : 'CHALLENGE (ENGINE)'}
            </Text>
          </Pressable>
          <Pressable style={styles.ctaMuted} onPress={() => onChallenge(true)}>
            <Text variant="caption" gold>
              SIM CAPTURE (GATED)
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
  },
  mapPlaneDev: {
    backgroundColor: '#061018',
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#071018',
  },
  atmosphereDev: {
    backgroundColor: '#0A1820',
  },
  mapBadge: {
    position: 'absolute',
    top: 12,
    left: 16,
    zIndex: 2,
  },
  routes: {
    flex: 1,
    marginTop: 28,
  },
  route: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: shell.routeGlow,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  node: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: shell.nodeGlow,
  },
  nodeActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: shell.accent,
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: shell.routeGlow,
    opacity: 0.55,
  },
  lineDev: {
    backgroundColor: '#6FA8C9',
  },
  lineActive: {
    opacity: 1,
    height: 3,
    backgroundColor: shell.accent,
  },
  routeLabel: {
    color: shell.muted,
    maxWidth: 180,
  },
  disclaimer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    color: shell.muted,
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
