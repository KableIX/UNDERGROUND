import { StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { shell } from '../theme/shell';

/** The old territory-capture flow demanded a start odometer photo. That step is retired. */
export function EvidenceCaptureStub() {
  return (
    <View style={styles.root}>
      <Text variant="caption" gold>
        EVIDENCE CAPTURE STUBS
      </Text>
      <Text style={styles.item}>Start odometer photos are no longer required.</Text>
      <Text style={styles.item}>1. GPS recording</Text>
      <Text style={styles.item}>2. Finish-line photo (finish zone)</Text>
      <Text style={styles.item}>3. End odometer photo (optional)</Text>
      <Text variant="caption" style={styles.meta}>
        SERVER AUTHORITATIVE · MOCK PATHS IN TESTS ONLY
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    gap: 8,
  },
  item: {
    color: shell.muted,
  },
  meta: {
    marginTop: 8,
    color: shell.muted,
  },
});
