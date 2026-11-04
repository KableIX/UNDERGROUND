import { BrandColors } from '@underground/domain';

export const shell = {
  background: BrandColors.nearBlack,
  tabBar: BrandColors.ink,
  accent: BrandColors.champagneGold,
  muted: BrandColors.fog,
  text: BrandColors.snow,
  mapVoid: BrandColors.mapVoid,
  routeGlow: BrandColors.routeGlow,
  nodeGlow: BrandColors.nodeGlow,
} as const;
