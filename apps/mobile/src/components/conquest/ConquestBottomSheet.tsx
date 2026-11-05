import { useState } from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TerritoryDefinition } from '@underground/domain';
import { Text } from '@underground/ui';
import { shell } from '../../theme/shell';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Track = 'solo' | 'club';

type Props = {
  territory: TerritoryDefinition | null;
  districtLabel: string;
  districtKind: 'development' | 'production_candidate';
  track: Track;
  onTrackChange: (track: Track) => void;
  ownershipLabel: string;
  previewMessage: string;
  onProdChallenge: () => void;
  onSimCapture: () => void;
  collapsedHint?: string;
};

/**
 * Collapsible map-first command sheet — NFS-style tactical panel, not a debug dump.
 */
export function ConquestBottomSheet({
  territory,
  districtLabel,
  districtKind,
  track,
  onTrackChange,
  ownershipLabel,
  previewMessage,
  onProdChallenge,
  onSimCapture,
  collapsedHint = 'Pull up for command',
}: Props) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(true);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable onPress={toggle} style={styles.handleHit} accessibilityRole="button">
        <View style={styles.handle} />
        {!expanded ? (
          <Text variant="caption" style={styles.hint}>
            {territory?.name ?? collapsedHint}
          </Text>
        ) : null}
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <Text variant="caption" gold>
            {districtLabel}
          </Text>
          <Text variant="title" gold style={styles.title}>
            {territory?.name ?? 'Select a route'}
          </Text>
          <Text variant="caption" style={styles.meta}>
            {districtKind === 'development' ? 'DEV DISTRICT' : 'PRODUCTION CANDIDATE'} ·{' '}
            {territory?.status.toUpperCase() ?? '—'} · WT {territory?.eligibleWeight ?? '—'}
          </Text>
          <Text variant="caption" style={styles.meta}>
            {ownershipLabel}
          </Text>

          <View style={styles.row}>
            <Chip label="SOLO" active={track === 'solo'} onPress={() => onTrackChange('solo')} />
            <Chip label="CLUB" active={track === 'club'} onPress={() => onTrackChange('club')} />
          </View>

          <Text style={styles.preview}>{previewMessage}</Text>

          <View style={styles.actions}>
            <Pressable style={styles.ctaGhost} onPress={onProdChallenge}>
              <Text variant="caption" gold>
                CAPTURE TERRITORY
              </Text>
            </Pressable>
            <Pressable style={styles.cta} onPress={onSimCapture}>
              <Text variant="caption" gold>
                SIM RUN
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({
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
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5,7,12,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(197,165,114,0.35)',
    paddingHorizontal: 16,
  },
  handleHit: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(197,165,114,0.45)',
  },
  hint: {
    marginTop: 8,
    color: shell.muted,
  },
  body: {
    paddingBottom: 8,
  },
  title: {
    marginTop: 4,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
  chipActive: {
    borderColor: shell.accent,
  },
  preview: {
    marginTop: 12,
    color: shell.accent,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  cta: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: shell.accent,
  },
  ctaGhost: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
});
