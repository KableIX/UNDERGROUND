import { StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { shell } from '../../theme/shell';
import { SafeLinearGradient } from './SafeLinearGradient';

type Props = {
  size?: 'hero' | 'compact';
  showWordmark?: boolean;
  showTagline?: boolean;
};

/**
 * Vector-style brand mark (pure RN) — no external logo binary required.
 * Matches near-black / champagne-gold theunderground.vip language.
 */
export function UndergroundMark({
  size = 'hero',
  showWordmark = true,
  showTagline = false,
}: Props) {
  const hero = size === 'hero';
  return (
    <View style={styles.root} accessibilityRole="image" accessibilityLabel="UNDERGROUND">
      <View style={[styles.glyph, hero ? styles.glyphHero : styles.glyphCompact]}>
        <SafeLinearGradient
          colors={['rgba(197,165,114,0.55)', 'rgba(197,165,114,0.12)', 'transparent']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.diamondOuter}>
          <View style={styles.diamondInner} />
        </View>
        <View style={styles.rule} />
      </View>
      {showWordmark ? (
        <Text variant="brand" gold style={[styles.wordmark, !hero && styles.wordmarkCompact]}>
          UNDERGROUND
        </Text>
      ) : null}
      {showTagline ? (
        <Text variant="caption" style={styles.tagline}>
          OWNERSHIP IS THE ENTRY.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
  },
  glyph: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    overflow: 'hidden',
  },
  glyphHero: {
    width: 88,
    height: 88,
  },
  glyphCompact: {
    width: 44,
    height: 44,
  },
  diamondOuter: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: shell.accent,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondInner: {
    width: 12,
    height: 12,
    backgroundColor: 'rgba(197,165,114,0.85)',
  },
  rule: {
    position: 'absolute',
    bottom: 10,
    width: 28,
    height: StyleSheet.hairlineWidth,
    backgroundColor: shell.accent,
  },
  wordmark: {
    marginTop: 22,
    textAlign: 'center',
  },
  wordmarkCompact: {
    marginTop: 10,
    fontSize: 16,
    letterSpacing: 3,
  },
  tagline: {
    marginTop: 10,
    color: shell.muted,
    letterSpacing: 2,
  },
});
