import type { ReactNode } from 'react';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { theme } from './theme';

type Variant = 'brand' | 'title' | 'body' | 'caption';

type Props = TextProps & {
  variant?: Variant;
  gold?: boolean;
  children: ReactNode;
};

export function Text({ variant = 'body', gold, style, children, ...rest }: Props) {
  const base = theme.typography[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: gold ? theme.colors.champagneGold : theme.colors.snow },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
