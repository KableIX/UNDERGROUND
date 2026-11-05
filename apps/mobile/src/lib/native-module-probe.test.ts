import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  isReactNativeMapsNativeAvailable,
  probeReactNativeMapsModule,
} from './native-module-probe';

describe('native-module-probe', () => {
  beforeEach(() => {
    managers.clear();
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
