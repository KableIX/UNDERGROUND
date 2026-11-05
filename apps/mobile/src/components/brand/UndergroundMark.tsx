import { Image, StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { shell } from '../../theme/shell';

type Props = {
  size?: 'hero' | 'compact';
  showWordmark?: boolean;
  showTagline?: boolean;
};

/**
 * Official UNDERGROUND tachometer/U icon, sourced from
 * https://theunderground.vip/assets/mark.svg?v=3
 * Rendered as local PNG to avoid an SVG native dependency in older iPhone builds.
 * Do not replace with the previous placeholder diamond.
 */
export function UndergroundMark({
  size = 'hero',
  showWordmark = true,
  showTagline = false,
}: Props) {
  const hero = size === 'hero';
  return (
    <View style={styles.root} accessibilityLabel="UNDERGROUND">
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../../assets/brand/underground-mark.png')}
        style={hero ? styles.markHero : styles.markCompact}
        resizeMode="contain"
        accessibilityLabel="UNDERGROUND tachometer emblem"
      />
      {showWordmark ? (
        <Text variant="brand" style={[styles.wordmark, !hero && styles.wordmarkCompact]}>
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
  root: { alignItems: 'center' },
  markHero: { width: 118, height: 118 },
  markCompact: { width: 62, height: 62 },
  wordmark: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 38,
    letterSpacing: 5,
    color: shell.text,
  },
  wordmarkCompact: { marginTop: 8, fontSize: 16, letterSpacing: 3 },
  tagline: { marginTop: 10, color: shell.muted, letterSpacing: 2 },
});
