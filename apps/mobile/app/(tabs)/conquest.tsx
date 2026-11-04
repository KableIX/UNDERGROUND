import { StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { mapboxConfigured } from '../../src/lib/env';
import { shell } from '../../src/theme/shell';
import { ConquestMap } from '../../src/components/ConquestMap';
import { EvidenceCaptureStub } from '../../src/components/EvidenceCaptureStub';
import { siliconValleyDistrict } from '../../src/data/silicon-valley-dev';

export default function ConquestScreen() {
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title" gold>
          Conquest
        </Text>
        <Text variant="caption" style={styles.meta}>
          MONTEREY = PRODUCTION CANDIDATE (DRAFT) · {siliconValleyDistrict.name.toUpperCase()} =
          DEV ONLY
        </Text>
        <Text variant="caption" style={styles.meta}>
          {mapboxConfigured ? 'MAPBOX READY' : 'DRAFT FALLBACK MAP — TOKEN ABSENT'}
        </Text>
        <GoldRule />
      </View>
      <ConquestMap />
      <View style={styles.evidence}>
        <EvidenceCaptureStub />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  meta: {
    marginTop: 6,
    color: shell.muted,
  },
  evidence: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    backgroundColor: shell.background,
  },
});
