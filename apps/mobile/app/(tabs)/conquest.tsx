import { StyleSheet, View } from 'react-native';
import { GoldRule, Screen, Text } from '@underground/ui';
import { mapboxConfigured } from '../../src/lib/env';
import { shell } from '../../src/theme/shell';
import { ConquestMap } from '../../src/components/ConquestMap';

export default function ConquestScreen() {
  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Text variant="title" gold>
          Monterey District
        </Text>
        <Text variant="caption" style={styles.meta}>
          {mapboxConfigured ? 'MAPBOX READY' : 'DRAFT FALLBACK MAP — TOKEN ABSENT'}
        </Text>
        <GoldRule />
      </View>
      <ConquestMap />
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
});
