import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { theme } from './theme';

type Variant = 'brand' | 'title' | 'body' | 'caption';

type Props = TextProps & {
  variant?: Variant;
  gold?: boolean;
  children: ReactNode;
};

export function Text({ variant = 'body', gold, style, children, ...rest }: Props) {
  const base = theme.typography[variant] as TextStyle;
  const override = StyleSheet.flatten(style);
  // A body line height inherited by a display-size heading clips its glyphs on iOS.
  const autoLeading = override?.fontSize && base.lineHeight && override.lineHeight === undefined && override.fontSize > base.fontSize!
    ? { lineHeight: Math.ceil(override.fontSize * 1.3) }
    : undefined;
  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: gold ? theme.colors.champagneGold : theme.colors.snow },
        autoLeading,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
