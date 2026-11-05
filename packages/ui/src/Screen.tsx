import type { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, View, type ViewProps } from 'react-native';
import { theme } from './theme';

type Props = ViewProps & {
  children: ReactNode;
  padded?: boolean;
};

export function Screen({ children, padded = true, style, ...rest }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View {...rest} style={[styles.inner, padded && styles.padded, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.nearBlack,
  },
  inner: {
    flex: 1,
    backgroundColor: theme.colors.nearBlack,
  },
  padded: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
});
