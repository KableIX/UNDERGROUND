import { MemoryTripStore, type TripStore } from '@underground/drive-tracking';

/**
 * Resolve the local trip store.
 * Prefer SQLite on device; MemoryTripStore for Node/tests.
 * Network is never required.
 */
export function createTripStore(): TripStore {
  // Vitest / Node: never touch native SQLite.
  if (typeof process !== 'undefined' && process.env?.VITEST) {
    return new MemoryTripStore();
  }
  try {
    // Lazy require keeps Node unit tests free of expo-sqlite.
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
