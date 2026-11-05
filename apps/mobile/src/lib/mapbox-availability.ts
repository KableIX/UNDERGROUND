import type { MapboxTokenStatus } from './mapbox-tokens';

export type NativeMapAvailability =
  | { ok: true; mode: 'native_mapbox' }
  | {
      ok: false;
      mode: 'tactical_fallback';
      reason:
        | 'missing_runtime_token'
        | 'native_module_unavailable'
        | 'forced_fallback'
        | 'unsupported_platform';
    };

/** Pure availability resolver — Vitest-safe (no react-native import). */
export function resolveMapAvailability(input: {
  tokens: MapboxTokenStatus;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  nativeModuleLoaded: boolean;
  forceFallback?: boolean;
}): NativeMapAvailability {
  if (input.forceFallback) {
    return { ok: false, mode: 'tactical_fallback', reason: 'forced_fallback' };
  }
  if (!input.tokens.canRenderMapboxStyle) {
    return { ok: false, mode: 'tactical_fallback', reason: 'missing_runtime_token' };
  }
  if (input.platform !== 'ios' && input.platform !== 'android') {
    return { ok: false, mode: 'tactical_fallback', reason: 'unsupported_platform' };
  }
  if (!input.nativeModuleLoaded) {
    return { ok: false, mode: 'tactical_fallback', reason: 'native_module_unavailable' };
  }
  return { ok: true, mode: 'native_mapbox' };
}
