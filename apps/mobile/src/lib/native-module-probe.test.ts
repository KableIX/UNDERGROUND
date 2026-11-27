import { beforeEach, describe, expect, it, vi } from 'vitest';

const optionalNative = vi.hoisted(() => vi.fn());
vi.mock('expo-modules-core', () => ({ requireOptionalNativeModule: optionalNative }));
const managers = new Set<string>();

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  UIManager: {
    getViewManagerConfig: (name: string) => (managers.has(name) ? { NativeProps: {} } : null),
    hasViewManagerConfig: (name: string) => managers.has(name),
  },
}));

import {
  isExpoLinearGradientNativeAvailable,
  isExpoSqliteNativeAvailable,
  isReactNativeMapsNativeAvailable,
  probeReactNativeMapsModule,
} from './native-module-probe';

describe('native-module-probe', () => {
  beforeEach(() => {
    managers.clear();
    optionalNative.mockReset();
    optionalNative.mockReturnValue(null);
  });

  it('rejects react-native-maps when AIRMap is not registered (Crash A guard)', () => {
    expect(isReactNativeMapsNativeAvailable()).toBe(false);
    const probe = probeReactNativeMapsModule();
    expect(probe.nativeLinked).toBe(false);
    expect(probe.usable).toBe(false);
  });

  it('accepts AIRMap when view manager is registered', () => {
    managers.add('AIRMap');
    expect(isReactNativeMapsNativeAvailable()).toBe(true);
  });

  it('detects ExpoLinearGradient manager names (Crash B guard)', () => {
    expect(isExpoLinearGradientNativeAvailable()).toBe(false);
    managers.add('ViewManagerAdapter_ExpoLinearGradient');
    expect(isExpoLinearGradientNativeAvailable()).toBe(true);
  });
});

describe('SQLite native registry check', () => {
  it('returns false without throwing for an IPA missing SQLite', () => {
    optionalNative.mockReturnValue(null);
    expect(isExpoSqliteNativeAvailable()).toBe(false);
    expect(optionalNative).toHaveBeenCalledWith('ExpoSQLite');
  });
  it('accepts a registered SQLite native module', () => {
    optionalNative.mockReturnValue({});
    expect(isExpoSqliteNativeAvailable()).toBe(true);
  });
  it('fails closed if native registry access fails', () => {
    optionalNative.mockImplementation(() => { throw new Error('registry unavailable'); });
    expect(isExpoSqliteNativeAvailable()).toBe(false);
  });
});
