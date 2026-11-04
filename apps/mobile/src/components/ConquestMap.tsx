import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { draftMontereyTerritories } from '../data/monterey-draft';
import { previewChallenge } from '../lib/challenge';
import { mapboxConfigured } from '../lib/env';
import { shell } from '../theme/shell';

type Track = 'solo' | 'club';

/**
 * Interactive Conquest map shell.
 * Mapbox mounts when token present (dev-build); otherwise dark fallback.
 * Illuminated draft routes + glowing nodes — no hex carpet.
 */
export function ConquestMap() {
  const [track, setTrack] = useState<Track>('solo');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(
    draftMontereyTerritories[0]?.slug ?? null,
  );
  const [lastPreview, setLastPreview] = useState<string>('No challenge preview yet.');

  const selected = useMemo(
    () => draftMontereyTerritories.find((t) => t.slug === selectedSlug) ?? null,
    [selectedSlug],
  );

  function onChallenge(isSimulation: boolean) {
    if (!selected) return;
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
      <View style={styles.mapPlane}>
        <View style={styles.atmosphere} />
        <Text variant="caption" gold style={styles.mapBadge}>
          {mapboxConfigured ? 'SATELLITE LAYER' : 'DARK FALLBACK · NO MAPBOX TOKEN'}
        </Text>
        <View style={styles.routes}>
          {draftMontereyTerritories.map((territory, index) => {
            const active = territory.slug === selectedSlug;
            return (
              <Pressable
                key={territory.id}
                onPress={() => setSelectedSlug(territory.slug)}
                style={[
                  styles.route,
                  {
                    top: 36 + index * 34,
                    opacity: active ? 1 : 0.55,
                    shadowOpacity: active ? 0.9 : 0.35,
                  },
                ]}
              >
                <View style={[styles.node, active && styles.nodeActive]} />
                <View style={[styles.line, active && styles.lineActive]} />
                <Text variant="caption" style={styles.routeLabel}>
                  {territory.name.toUpperCase()} · DRAFT
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text variant="caption" style={styles.disclaimer}>
          PLACEHOLDER LINESTRINGS — NOT PRODUCTION ROAD GEOMETRY
        </Text>
      </View>

      <View style={styles.panel}>
        <View style={styles.modes}>
          <ModeChip label="SOLO" active={track === 'solo'} onPress={() => setTrack('solo')} />
          <ModeChip label="CLUB" active={track === 'club'} onPress={() => setTrack('club')} />
        </View>
        <Text variant="title" gold>
          {selected?.name ?? 'Select a territory'}
        </Text>
        <Text variant="caption" style={styles.meta}>
          STATUS {selected?.status.toUpperCase() ?? '—'} · TRACK {track.toUpperCase()} · WEIGHT{' '}
          {selected?.eligibleWeight ?? '—'}
        </Text>
        <Text style={styles.body}>
          Ownership panel calls territory-engine contracts. Draft territories reject production
          captures. Sim evidence cannot write production ownership.
        </Text>
        <Text variant="caption" style={styles.preview}>
          {lastPreview}
        </Text>
        <View style={styles.actions}>
          <Pressable style={styles.cta} onPress={() => onChallenge(false)}>
            <Text variant="caption" gold>
              CHALLENGE (ENGINE)
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
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#071018',
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
  lineActive: {
    opacity: 1,
    height: 3,
    backgroundColor: shell.accent,
  },
  routeLabel: {
    color: shell.muted,
    maxWidth: 160,
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
    marginBottom: 14,
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
