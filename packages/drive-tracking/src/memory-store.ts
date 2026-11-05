import { toTripSummary, type SessionEngineState } from './session';
import type { TripStore } from './store';
import type { DriveSession, GpsSample, SignalEvent, TripSummary } from './types';

/** In-memory trip store for unit tests and Node environments. */
export class MemoryTripStore implements TripStore {
  private readonly byId = new Map<string, SessionEngineState>();

  async saveSession(state: SessionEngineState): Promise<void> {
    this.byId.set(state.session.id, {
      session: { ...state.session },
      samples: state.samples.map(s => ({ ...s, flags: { ...s.flags } })),
      events: state.events.map(e => ({ ...e })),
      segmentStartedAtMs: state.segmentStartedAtMs,
      privateSpeedMps: state.privateSpeedMps,
    });
  }

  async getSession(sessionId: string): Promise<SessionEngineState | null> {
    const s = this.byId.get(sessionId);
    if (!s) return null;
    return {
      session: { ...s.session },
      samples: s.samples.map(sample => ({ ...sample, flags: { ...sample.flags } })),
      events: s.events.map(e => ({ ...e })),
      segmentStartedAtMs: s.segmentStartedAtMs,
      privateSpeedMps: s.privateSpeedMps,
    };
  }

  async listTripSummaries(): Promise<TripSummary[]> {
    const summaries: TripSummary[] = [];
    for (const state of this.byId.values()) {
      if (state.session.status !== 'ended' && state.session.startedAtMs == null) continue;
      if (!state.session.startedAtMs) continue;
      // Include ended trips and in-progress for offline access of history + active.
      const summary = toTripSummary(state);
      if (summary) summaries.push(summary);
    }
    return summaries.sort((a, b) => b.startedAtMs - a.startedAtMs);
  }

  async deleteTrip(sessionId: string): Promise<void> {
    this.byId.delete(sessionId);
  }

  async findRecoverableSession(): Promise<SessionEngineState | null> {
    for (const state of this.byId.values()) {
      if (
        state.session.status === 'interrupted' ||
        state.session.status === 'paused' ||
        state.session.status === 'recording'
      ) {
        return this.getSession(state.session.id);
      }
    }
    return null;
  }

  async appendSamples(sessionId: string, samples: readonly GpsSample[]): Promise<void> {
    const state = this.byId.get(sessionId);
    if (!state) return;
    state.samples.push(...samples.map(s => ({ ...s, flags: { ...s.flags } })));
  }

  async appendEvents(sessionId: string, events: readonly SignalEvent[]): Promise<void> {
    const state = this.byId.get(sessionId);
    if (!state) return;
    state.events.push(...events.map(e => ({ ...e })));
  }

  async updateSessionMeta(session: DriveSession): Promise<void> {
    const state = this.byId.get(session.id);
    if (!state) return;
    state.session = { ...session };
  }

  /** Test helper */
  clear(): void {
    this.byId.clear();
  }
}
