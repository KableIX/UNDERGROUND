import { NativeModules } from 'react-native';
import { hapticPlan, playHaptics, type HapticEvent, type HapticsModule } from './haptics';
import type { SupercargoTier } from '@underground/domain';
import { safeLoad } from './safe';

/*
 * expo-camera, expo-sensors, expo-haptics and react-native-view-shot are native
 * modules that arrive with a new development build. The JS ships to every build,
 * so each one is loaded defensively: on an older build the loader returns null
 * and the screen falls back (system camera, drifting foil, no haptics, text-and-photo
 * share). Nothing here may throw.
 */

type Camera = typeof import('expo-camera');
type Sensors = typeof import('expo-sensors');
type ViewShot = typeof import('react-native-view-shot');

const cache = new Map<string, unknown>();
function once<T>(key: string, load: () => T | null): T | null {
  if (!cache.has(key)) cache.set(key, load());
  return (cache.get(key) as T | null) ?? null;
}

export const loadCamera = () =>
  once<Camera>('camera', () =>
    safeLoad(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('expo-camera') as Camera;
      return typeof m.CameraView === 'function' && m.Camera ? m : null;
    }),
  );

export const loadSensors = () =>
  once<Sensors>('sensors', () =>
    safeLoad(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('expo-sensors') as Sensors;
      return m.DeviceMotion ? m : null;
    }),
  );

export const loadHaptics = () =>
  once<HapticsModule>('haptics', () =>
    safeLoad(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('expo-haptics') as unknown as HapticsModule;
      return typeof m.impactAsync === 'function' ? m : null;
    }),
  );

/** react-native-view-shot needs its native side; the JS alone loads fine, so check for it. */
export const loadViewShot = () =>
  once<ViewShot>('viewshot', () =>
    safeLoad(() => {
      if (!NativeModules.RNViewShot) return null;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const m = require('react-native-view-shot') as ViewShot;
      return typeof m.captureRef === 'function' ? m : null;
    }),
  );

/** Fire and forget. Silent where there is no haptics module. */
export function haptic(event: HapticEvent, tier?: SupercargoTier) {
  void playHaptics(hapticPlan(event, tier), loadHaptics());
}
