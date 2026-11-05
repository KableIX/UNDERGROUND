import type { PublicEnv } from '@underground/domain';

/** Santa Clara / NVIDIA-area camera (public landmark centroid). */
export const SV_DEV_CAMERA = {
  longitude: -121.9677,
  latitude: 37.3706,
  zoom: 12.2,
} as const;

export const MONTEREY_CAMERA = {
  longitude: -121.9,
  latitude: 36.58,
  zoom: 10.2,
} as const;

/**
 * Mapbox Static Images URL for dark tactical satellite backdrop.
 * Returns null when token absent — callers must use the dark fallback plane.
 */
export function buildMapboxSatelliteUrl(input: {
  env: Pick<PublicEnv, 'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN'>;
  longitude: number;
  latitude: number;
  zoom: number;
  width: number;
  height: number;
}): string | null {
  const token = input.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const w = Math.min(1280, Math.max(320, Math.round(input.width)));
  const h = Math.min(1280, Math.max(240, Math.round(input.height)));
  // satellite-v9 + dark overlay via style — pure satellite for tactical base
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${input.longitude},${input.latitude},${input.zoom},0/${w}x${h}@2x` +
    `?access_token=${encodeURIComponent(token)}`
  );
}
