import type { DriveSession, GpsSample, SignalEvent, TripSummary } from './types';
import type { SessionEngineState } from './session';

/**
 * Persistence port — implementations: MemoryTripStore (tests) / SqliteTripStore (device).
 * Survives network loss by design (local-only).
 */
export interface TripStore {
  saveSession(state: SessionEngineState): Promise<void>;
  getSession(sessionId: string): Promise<SessionEngineState | null>;
  listTripSummaries(): Promise<TripSummary[]>;
  deleteTrip(sessionId: string): Promise<void>;
  findRecoverableSession(): Promise<SessionEngineState | null>;
  /** Append samples incrementally during recording (battery-conscious batching OK). */
  appendSamples(sessionId: string, samples: readonly GpsSample[]): Promise<void>;
  appendEvents(sessionId: string, events: readonly SignalEvent[]): Promise<void>;
  updateSessionMeta(session: DriveSession): Promise<void>;
}

export function serializeEngineState(state: SessionEngineState): string {
  return JSON.stringify(state);
}

export function deserializeEngineState(raw: string): SessionEngineState {
  return JSON.parse(raw) as SessionEngineState;
}
