import { StyleSheet, Text, View } from 'react-native';
import type { SupercargoTier } from '@underground/domain';
import { tierLabel, tierRank } from './copy';

/** Six hairline ticks and a small-caps label. Gold is reserved for Singular. */
export function TierMark({ tier }: { tier: SupercargoTier }) {
  const rank = tierRank(tier);
  const gold = tier === 'singular';
  return (
    <View style={s.row} accessibilityLabel={tierLabel(tier) + ' tier'}>
      <View style={s.ticks}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={[s.tick, i < rank && (gold ? s.gold : s.on)]} />
        ))}
      </View>
      <Text style={[s.label, gold && { color: '#C6B08B' }]}>{tierLabel(tier).toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ticks: { flexDirection: 'row', gap: 2 },
  tick: { width: 2, height: 10, backgroundColor: '#2C2D31' },
  on: { backgroundColor: '#B7B7B8' },
  gold: { backgroundColor: '#C6B08B' },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1.6, color: '#B7B7B8' },
});
