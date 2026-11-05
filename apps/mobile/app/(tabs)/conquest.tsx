import { StyleSheet } from 'react-native';
import { Screen } from '@underground/ui';
import { ConquestMap } from '../../src/components/ConquestMap';
import { shell } from '../../src/theme/shell';

/** Map-first Conquest tab — command sheet lives inside the map surface. */
export default function ConquestScreen() {
  return (
    <Screen padded={false} style={styles.root}>
      <ConquestMap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: shell.mapVoid,
  },
});
