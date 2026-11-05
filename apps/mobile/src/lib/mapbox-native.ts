import { Platform } from 'react-native';
import { mapboxConfigured } from './env';
import { getMapboxTokenStatus } from './mapbox-tokens';
import {
  resolveMapAvailability,
  type NativeMapAvailability,
} from './mapbox-availability';

export type { NativeMapAvailability } from './mapbox-availability';

/**
 * Probe @rnmapbox/maps without crashing Metro when the native binary is absent.
 * Compatibility with Expo 52 / RN 0.76.9 is declared via dependency pin — NOT device-verified here.
 */
export function probeNativeMapbox(opts?: { forceFallback?: boolean }): NativeMapAvailability {
  const tokens = getMapboxTokenStatus({
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
    RNMAPBOX_MAPS_DOWNLOAD_TOKEN: process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN,
  });

  const platform =
    Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web'
      ? Platform.OS
      : 'unknown';

  let nativeModuleLoaded = false;
  if (tokens.canRenderMapboxStyle && mapboxConfigured && !opts?.forceFallback) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@rnmapbox/maps');
      nativeModuleLoaded = Boolean(mod?.default?.MapView || mod?.MapView);
    } catch {
      nativeModuleLoaded = false;
    }
  }

  return resolveMapAvailability({
    tokens: {
      ...tokens,
      canRenderMapboxStyle: tokens.canRenderMapboxStyle && mapboxConfigured,
    },
    platform,
    nativeModuleLoaded,
    forceFallback: opts?.forceFallback,
  });
}

export function setMapboxAccessTokenSafe(token: string): { ok: boolean; error?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Mapbox = require('@rnmapbox/maps');
    const api = Mapbox.default ?? Mapbox;
    if (typeof api.setAccessToken === 'function') {
      api.setAccessToken(token);
      return { ok: true };
    }
    return { ok: false, error: 'setAccessToken_missing' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'require_failed',
    };
  }
}
