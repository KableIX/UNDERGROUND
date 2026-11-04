import { StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { shell } from '../../src/theme/shell';

/**
 * Newswire shell — stories generate from capture_accepted_v1 templates
 * when runs reach ACCEPTED on the production evidence path.
 */
export default function NewswireScreen() {
  return (
    <Screen>
      <Text variant="brand" gold>
        UNDERGROUND
      </Text>
      <Text variant="caption" style={styles.tagline}>
        OWNERSHIP IS THE ENTRY.
      </Text>
      <GoldRule />
      <Text variant="title">Newswire</Text>
      <Text style={styles.body}>
        Event-driven stories use deterministic template `capture_accepted_v1` on verified ACCEPTED
        runs. No fabricated achievements — CLOUT deltas come from the ledger stub.
      </Text>
      <View style={styles.placeholder}>
        <Text variant="caption" gold>
          NO STORIES YET
        </Text>
        <Text variant="caption" style={styles.meta}>
          TEMPLATE READY · AWAITING ACCEPTED RUNS
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: {
    marginTop: 8,
    color: shell.muted,
  },
  body: {
    marginTop: 8,
    color: shell.muted,
  },
  placeholder: {
    marginTop: 32,
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
  },
  meta: {
    color: shell.muted,
  },
});
