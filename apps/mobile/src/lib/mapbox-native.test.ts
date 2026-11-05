import { describe, expect, it } from 'vitest';
import { getMapboxTokenStatus } from './mapbox-tokens';
import { resolveMapAvailability } from './mapbox-availability';

describe('mapbox tokens + availability', () => {
  it('separates public runtime vs private download tokens', () => {
    const status = getMapboxTokenStatus({
      EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: '',
      RNMAPBOX_MAPS_DOWNLOAD_TOKEN: '',
    });
    expect(status.canRenderMapboxStyle).toBe(false);
    expect(status.requiresCustomDevClient).toBe(true);
    expect(status.nativeModuleVerifiedOnDevice).toBe(false);

    const withPublic = getMapboxTokenStatus({
      EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
      RNMAPBOX_MAPS_DOWNLOAD_TOKEN: '',
    });
    expect(withPublic.runtimePublicConfigured).toBe(true);
    expect(withPublic.downloadPrivateConfigured).toBe(false);
    expect(withPublic.canRenderMapboxStyle).toBe(true);
  });

  it('falls back when forced, token missing, or native absent', () => {
    const tokens = getMapboxTokenStatus({
      EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: 'pk.test',
      RNMAPBOX_MAPS_DOWNLOAD_TOKEN: 'sk.test',
    });

    expect(
      resolveMapAvailability({
        tokens,
        platform: 'ios',
        nativeModuleLoaded: true,
        forceFallback: true,
      }),
    ).toEqual({ ok: false, mode: 'tactical_fallback', reason: 'forced_fallback' });

    expect(
      resolveMapAvailability({
        tokens: getMapboxTokenStatus({}),
        platform: 'ios',
        nativeModuleLoaded: true,
      }),
    ).toEqual({ ok: false, mode: 'tactical_fallback', reason: 'missing_runtime_token' });

    expect(
      resolveMapAvailability({
        tokens,
        platform: 'ios',
        nativeModuleLoaded: false,
      }),
    ).toEqual({ ok: false, mode: 'tactical_fallback', reason: 'native_module_unavailable' });

    expect(
      resolveMapAvailability({
        tokens,
        platform: 'ios',
        nativeModuleLoaded: true,
      }),
    ).toEqual({ ok: true, mode: 'native_mapbox' });
  });
});
