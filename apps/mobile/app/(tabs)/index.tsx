import { StyleSheet } from 'react-native';
import { Screen } from '@underground/ui';
import { ConquestMap } from '../../src/components/ConquestMap';
import { shell } from '../../src/theme/shell';

/** The geographic map is a first-class destination, independent of curated territories. */
export default function WorldMapScreen() {
  return (
    <Screen padded={false} style={styles.root}>
      <ConquestMap initialMode="explore" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.mapVoid },
});
