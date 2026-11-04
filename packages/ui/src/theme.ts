import { BrandColors } from '@underground/domain';

export const theme = {
  colors: BrandColors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 40,
  },
  typography: {
    brand: {
      fontFamily: 'System',
      fontSize: 28,
      letterSpacing: 4,
      fontWeight: '600' as const,
    },
    title: {
      fontFamily: 'System',
      fontSize: 22,
      letterSpacing: 1,
      fontWeight: '600' as const,
    },
    body: {
      fontFamily: 'System',
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
    },
    caption: {
      fontFamily: 'System',
      fontSize: 12,
      letterSpacing: 1.5,
      fontWeight: '500' as const,
    },
  },
} as const;

export type Theme = typeof theme;
