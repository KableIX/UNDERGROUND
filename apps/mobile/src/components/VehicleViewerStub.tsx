import { StyleSheet, View } from 'react-native';
import { Text } from '@underground/ui';
import { shell } from '../theme/shell';

/** 3D viewer interface stub only — no 3D dependency. */
export function VehicleViewerStub({ label }: { label: string }) {
  return (
    <View style={styles.root}>
      <Text variant="caption" gold>
        3D VIEWER STUB
      </Text>
      <Text style={styles.body}>{label}</Text>
      <Text variant="caption" style={styles.meta}>
        NO 3D RUNTIME · INTERFACE ONLY
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 16,
    paddingVertical: 40,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197,165,114,0.35)',
    backgroundColor: shell.tabBar,
  },
  body: {
    marginTop: 10,
    color: shell.muted,
  },
  meta: {
    marginTop: 8,
    color: shell.muted,
  },
});
