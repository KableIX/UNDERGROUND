import { Platform, UIManager } from 'react-native';

/**
 * Native view-manager probes for custom-dev-client binaries.
 * JS packages can load while the IPA still lacks the linked native module
 * (Fast Refresh never adds native code). Rendering those views crashes:
 * - AIRMap → Cannot read property 'bubblingEventTypes' of null
 * - ExpoLinearGradient → Unimplemented component: ViewManagerAdapter_ExpoLinearGradient
 */

type UiManagerLike = {
  getViewManagerConfig?: (name: string) => unknown;
  hasViewManagerConfig?: (name: string) => boolean;
  [key: string]: unknown;
};

function viewManagerPresent(name: string): boolean {
  const ui = UIManager as unknown as UiManagerLike;
  try {
    if (typeof ui.hasViewManagerConfig === 'function' && ui.hasViewManagerConfig(name)) {
      return true;
    }
  } catch {
    // continue
  }
  try {
    if (typeof ui.getViewManagerConfig === 'function') {
      const cfg = ui.getViewManagerConfig(name);
      if (cfg != null) return true;
    }
  } catch {
    // continue
  }
  try {
    if (ui[name] != null) return true;
  } catch {
    // continue
  }
  return false;
}

/** react-native-maps Apple/default MapView (AIRMap) or Fabric RNMapsMapView. */
export function isReactNativeMapsNativeAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return (
    viewManagerPresent('AIRMap') ||
    viewManagerPresent('RNMapsMapView') ||
    viewManagerPresent('AIRGoogleMap')
  );
}

/** expo-linear-gradient Fabric / Paper names. */
export function isExpoLinearGradientNativeAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  return (
    viewManagerPresent('ExpoLinearGradient') ||
    viewManagerPresent('ViewManagerAdapter_ExpoLinearGradient') ||
    viewManagerPresent('ExponentLinearGradient')
  );
}

/** expo-sqlite — avoid Trip History hard failures on mismatched IPA. */
export function isExpoSqliteNativeAvailable(): boolean {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const SQLite = require('expo-sqlite') as { openDatabaseAsync?: unknown };
    return typeof SQLite?.openDatabaseAsync === 'function';
  } catch {
    return false;
  }
}

/**
 * Probe react-native-maps JS + native together.
 * JS-only presence is NOT enough — that is Crash A.
 */
export function probeReactNativeMapsModule(): {
  jsLoaded: boolean;
  nativeLinked: boolean;
  usable: boolean;
} {
  let jsLoaded = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-maps');
    jsLoaded = Boolean(mod?.default);
  } catch {
    jsLoaded = false;
  }
  const nativeLinked = isReactNativeMapsNativeAvailable();
  return { jsLoaded, nativeLinked, usable: jsLoaded && nativeLinked };
}
