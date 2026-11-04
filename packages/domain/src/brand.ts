/** Near-black / champagne-gold brand tokens (shared conceptual palette). */
export const BrandColors = {
  nearBlack: '#0A0B0D',
  ink: '#12141A',
  surface: '#1A1C24',
  champagneGold: '#C5A572',
  champagneGoldMuted: '#8F7A52',
  fog: '#A8ADB8',
  snow: '#F4F1EA',
  danger: '#B33A3A',
  success: '#3D7A5A',
  mapVoid: '#05070C',
  routeGlow: '#D4B483',
  nodeGlow: '#E8D5A8',
} as const;

export type BrandColor = (typeof BrandColors)[keyof typeof BrandColors];
