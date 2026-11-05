/** Near-black / champagne-gold brand tokens (shared conceptual palette). */
export const BrandColors = {
  nearBlack: '#08090A',
  ink: '#12141A',
  surface: '#1A1C24',
  champagneGold: '#C6B08B',
  champagneGoldMuted: '#8F7A52',
  fog: '#B7B7B8',
  snow: '#F4F2ED',
  danger: '#B33A3A',
  success: '#3D7A5A',
  mapVoid: '#05070C',
  routeGlow: '#D4B483',
  nodeGlow: '#E8D5A8',
} as const;

export type BrandColor = (typeof BrandColors)[keyof typeof BrandColors];
