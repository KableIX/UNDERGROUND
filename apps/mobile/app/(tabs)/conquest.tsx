import { StyleSheet } from 'react-native';
import { Screen } from '@underground/ui';
import { PlaySelector } from '../../src/components/play/PlaySelector';
import { shell } from '../../src/theme/shell';

/** PLAY is a region → area → conquest selector. MAP remains its own tab. */
export default function PlayScreen() {
  return (
    <Screen padded={false} style={styles.root}>
      <PlaySelector />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.mapVoid },
});
