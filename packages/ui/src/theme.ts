import { BrandColors } from '@underground/domain';

/**
 * Premium type stack for UNDERGROUND.
 * Cinzel (display) + DM Sans (UI) — loaded in apps/mobile root layout.
 * Falls back to System if fonts not yet loaded.
 */
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
      fontFamily: 'Cinzel_600SemiBold',
      fontSize: 30,
      letterSpacing: 5,
      fontWeight: '600' as const,
    },
    title: {
      fontFamily: 'DMSans_600SemiBold',
      fontSize: 22,
      letterSpacing: 0.5,
      fontWeight: '600' as const,
    },
    body: {
      fontFamily: 'DMSans_400Regular',
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
    },
    caption: {
      fontFamily: 'DMSans_500Medium',
      fontSize: 11,
      letterSpacing: 1.6,
      fontWeight: '500' as const,
    },
  },
} as const;

export type Theme = typeof theme;
