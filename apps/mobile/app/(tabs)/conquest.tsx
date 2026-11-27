import { StyleSheet } from 'react-native';
import { Screen } from '@underground/ui';
import { DriveMenu } from '../../src/components/play/PlaySelector';
import { shell } from '../../src/theme/shell';

export default function DriveScreen() {
  return (
    <Screen padded={false} style={styles.root}>
      <DriveMenu />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shell.mapVoid },
});
