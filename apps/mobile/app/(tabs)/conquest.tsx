import { StyleSheet } from 'react-native';
import { Screen } from '@underground/ui';
import { FullWorldMap } from '../../src/components/map/FullWorldMap';
import { shell } from '../../src/theme/shell';

/** Map-first validation: full geographic basemap now; curated territory overlays later. */
export default function ConquestScreen() {
  return (
    <Screen padded={false} style={styles.root}>
      <FullWorldMap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: shell.mapVoid,
  },
});
