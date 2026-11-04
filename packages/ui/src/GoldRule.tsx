import { StyleSheet, View } from 'react-native';
import { theme } from './theme';

export function GoldRule() {
  return <View style={styles.rule} />;
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.champagneGoldMuted,
    opacity: 0.6,
    marginVertical: theme.spacing.md,
  },
});
