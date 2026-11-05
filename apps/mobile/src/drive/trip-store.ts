import { MemoryTripStore, type TripStore } from '@underground/drive-tracking';

/**
 * Resolve the local trip store.
 * Prefer SQLite on device; MemoryTripStore for Node/tests or mismatched IPA.
 * Network is never required. Missing expo-sqlite must not crash Trip History.
 */
export function createTripStore(): TripStore {
  // Vitest / Node: never touch native SQLite.
  if (typeof process !== 'undefined' && process.env?.VITEST) {
    return new MemoryTripStore();
  }
  try {
    // Lazy require keeps Node unit tests free of react-native / expo-sqlite.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isExpoSqliteNativeAvailable } = require('../lib/native-module-probe') as typeof import('../lib/native-module-probe');
    if (!isExpoSqliteNativeAvailable()) {
      return new MemoryTripStore();
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSqliteTripStore } = require('./sqlite-trip-store') as typeof import('./sqlite-trip-store');
    return getSqliteTripStore();
  } catch {
    return new MemoryTripStore();
  }
}

let shared: TripStore | null = null;

export function getTripStore(): TripStore {
  if (!shared) shared = createTripStore();
  return shared;
}

/** Test hook */
export function setTripStoreForTests(store: TripStore | null): void {
  shared = store;
}
