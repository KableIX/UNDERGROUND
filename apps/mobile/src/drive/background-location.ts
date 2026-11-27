import { applyGpsFix, type RawFix } from '@underground/drive-tracking';
import { getTripStore } from './trip-store';

/**
 * Background GPS for an active drive or Run, so recording continues while the
 * iPhone is locked or another app is in front.
 *
 * - Runs only between Start and End/Pause of a recording the member started.
 * - iOS shows the blue location indicator the whole time (showsBackgroundLocationIndicator).
 * - Requires "Always" location permission. If the member declines, the recorder falls
 *   back to foreground-only and pauses on lock, exactly as before.
 * - Fixes are real device fixes only. Nothing is interpolated or invented.
 *
 * The task must be defined at module load (app/_layout.tsx imports this file) so iOS
 * can deliver locations after relaunching the app in the background.
 */
export const DRIVE_LOCATION_TASK = 'underground-drive-location';

export type DriveFix = RawFix;
type Listener = (fixes: DriveFix[]) => void;
const listeners = new Set<Listener>();

/** Receive background fixes while a screen is mounted. Returns an unsubscribe. */
export function onDriveFixes(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

type LocationLike = {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    altitude: number | null;
    accuracy: number | null;
    speed: number | null;
    heading: number | null;
  };
};

export function toDriveFix(location: LocationLike): DriveFix {
  const { latitude, longitude, altitude, accuracy, speed, heading } = location.coords;
  return {
    timestampMs: location.timestamp,
    latitude,
    longitude,
    altitudeM: altitude,
    accuracyM: accuracy,
    speedMps: speed,
    headingDeg: heading,
  };
}

/** Deliver a batch to mounted screens, or straight into the persisted session when none are. */
export async function deliverDriveFixes(fixes: DriveFix[]): Promise<void> {
  if (!fixes.length) return;
  if (listeners.size) {
    listeners.forEach(listener => listener(fixes));
    return;
  }
  // No screen mounted (app relaunched in the background): keep the saved session current.
  const store = getTripStore();
  const saved = await store.findRecoverableSession();
  if (!saved || saved.session.status !== 'recording') return;
  let next = saved;
  for (const fix of fixes) next = applyGpsFix(next, fix).state;
  if (next !== saved) await store.saveSession(next);
}

function locationModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-location') as typeof import('expo-location');
}
function taskManager() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-task-manager') as typeof import('expo-task-manager');
}

/** Safe to call more than once. Never throws: an older binary without the module just stays foreground-only. */
export function defineDriveLocationTask(): boolean {
  try {
    const TaskManager = taskManager();
    if (TaskManager.isTaskDefined(DRIVE_LOCATION_TASK)) return true;
    TaskManager.defineTask<{ locations?: LocationLike[] }>(DRIVE_LOCATION_TASK, async ({ data, error }) => {
      if (error || !data?.locations?.length) return;
      try {
        await deliverDriveFixes(data.locations.map(toDriveFix));
      } catch {
        // A failed write must not stop location delivery; the next batch retries.
      }
    });
    return true;
  } catch {
    return false;
  }
}

export async function isBackgroundDriveRunning(): Promise<boolean> {
  try {
    return await locationModule().hasStartedLocationUpdatesAsync(DRIVE_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Start background updates for a recording. Asks for "Always" permission the first time.
 * Returns false (foreground-only) when permission is declined or the build lacks the module.
 */
export async function startBackgroundDrive(): Promise<boolean> {
  try {
    if (!defineDriveLocationTask()) return false;
    const Location = locationModule();
    const foreground = await Location.getForegroundPermissionsAsync();
    if (foreground.status !== 'granted') return false;
    let background = await Location.getBackgroundPermissionsAsync();
    if (background.status !== 'granted' && background.canAskAgain) {
      background = await Location.requestBackgroundPermissionsAsync();
    }
    if (background.status !== 'granted') return false;
    if (await Location.hasStartedLocationUpdatesAsync(DRIVE_LOCATION_TASK)) return true;
    await Location.startLocationUpdatesAsync(DRIVE_LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 5,
      timeInterval: 1500,
      deferredUpdatesInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'UNDERGROUND',
        notificationBody: 'Recording your drive.',
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function stopBackgroundDrive(): Promise<void> {
  try {
    const Location = locationModule();
    if (await Location.hasStartedLocationUpdatesAsync(DRIVE_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(DRIVE_LOCATION_TASK);
    }
  } catch {
    // Nothing running, or the module is missing in this build.
  }
}
