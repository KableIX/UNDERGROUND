import { ScrollView, StyleSheet, View } from 'react-native';
import { FOUNDER_DISPLAY_NAME, FOUNDER_MEMBER_NUMBER, rankMembers } from '@underground/domain';
import { GoldRule, Screen, Text } from '@underground/ui';
import { rankingFixtures } from '../../src/data/rankings';
import { shell } from '../../src/theme/shell';

/**
 * Rankings — CLOUT / territory standings from fixtures until live ledgers persist.
 */
export default function RankingsScreen() {
  const ranked = rankMembers(rankingFixtures);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title" gold>
          Rankings
        </Text>
        <Text variant="caption" style={styles.meta}>
          CLOUT LEDGER · FIXTURE STANDINGS · LIVE AFTER PRODUCTION ACCEPTED
        </Text>
        <GoldRule />
        <Text style={styles.body}>
          Founder {FOUNDER_DISPLAY_NAME} #{FOUNDER_MEMBER_NUMBER} appears from seed CLOUT only.
          Simulation captures never move these ranks.
        </Text>
        {ranked.map((entry) => (
          <View key={entry.memberId} style={styles.row}>
            <Text variant="caption" gold style={styles.rank}>
              #{entry.rank}
            </Text>
            <View style={styles.copy}>
              <Text>
                {entry.displayName} · #{entry.memberNumber}
              </Text>
              <Text style={styles.body}>
                CLOUT {entry.cloutTotal} · TERRITORIES {entry.territoriesHeld}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
    color: shell.muted,
  },
  row: {
    marginTop: 18,
    flexDirection: 'row',
    gap: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(197,165,114,0.2)',
  },
  rank: {
    width: 36,
    marginTop: 2,
  },
  copy: {
    flex: 1,
  },
});
