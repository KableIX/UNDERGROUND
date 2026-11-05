import { INTERRUPT_ABANDON_MS, SIGNAL_LOSS_GAP_MS } from './constants';
import { createId } from './ids';
import { ingestGpsFix, type RawFix } from './ingest';
import { aggregateGpsQuality } from './quality';
import type {
  DriveSession,
  GpsSample,
  IngestResult,
  SignalEvent,
  TripClassification,
  TripSummary,
} from './types';

export type SessionEngineState = {
  session: DriveSession;
  samples: GpsSample[];
  events: SignalEvent[];
  /** Wall-clock when current recording segment started (null if paused/idle). */
  segmentStartedAtMs: number | null;
  /** Private live speed — never exported to analytics. */
  privateSpeedMps: number | null;
};

export type SessionEngineOptions = {
  idFactory?: (prefix: string) => string;
  nowMs?: () => number;
  vehicleId?: string | null;
  curatedRouteId?: string | null;
  classification?: TripClassification;
};

function baseSession(
  id: string,
  nowMs: number,
  opts: SessionEngineOptions,
): DriveSession {
  return {
    id,
    status: 'idle',
    classification: opts.classification ?? 'ordinary',
    vehicleId: opts.vehicleId ?? null,
    curatedRouteId: opts.curatedRouteId ?? null,
    serverVerifiedRunId: null,
    startedAtMs: null,
    endedAtMs: null,
    activeDurationMs: 0,
    distanceM: 0,
    startLabel: null,
    finishLabel: null,
    gpsQuality: 'unknown',
    privacy: 'private',
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    lastSampleAtMs: null,
    interruptionCount: 0,
  };
}

export function createSessionEngine(opts: SessionEngineOptions = {}): SessionEngineState {
  const idFactory = opts.idFactory ?? createId;
  const now = opts.nowMs?.() ?? Date.now();
  return {
    session: baseSession(idFactory('trip'), now, opts),
    samples: [],
    events: [],
    segmentStartedAtMs: null,
    privateSpeedMps: null,
  };
}

function touch(session: DriveSession, nowMs: number): DriveSession {
  return { ...session, updatedAtMs: nowMs };
}

function flushActive(state: SessionEngineState, nowMs: number): DriveSession {
  if (state.segmentStartedAtMs == null) return state.session;
  const delta = Math.max(0, nowMs - state.segmentStartedAtMs);
  return {
    ...state.session,
    activeDurationMs: state.session.activeDurationMs + delta,
    updatedAtMs: nowMs,
  };
}

export function startRecording(
  state: SessionEngineState,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (state.session.status === 'recording') return state;
  if (state.session.status === 'ended') {
    return startRecording(createSessionEngine({ ...opts, idFactory: opts.idFactory }), opts);
  }
  const startedAtMs = state.session.startedAtMs ?? now;
  return {
    ...state,
    session: touch(
      {
        ...state.session,
        status: 'recording',
        startedAtMs,
      },
      now,
    ),
    segmentStartedAtMs: now,
    privateSpeedMps: null,
  };
}

export function pauseRecording(
  state: SessionEngineState,
  opts: { nowMs?: () => number; reason?: 'user' | 'permission' | 'background' } = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (state.session.status !== 'recording') return state;
  const session = flushActive(state, now);
  const events = [...state.events];
  if (opts.reason === 'permission') {
    events.push({
      id: (opts as SessionEngineOptions).idFactory?.('evt') ?? createId('evt', now),
      sessionId: session.id,
      kind: 'permission_lost',
      atMs: now,
    });
  }
  return {
    ...state,
    session: { ...session, status: 'paused' },
    events,
    segmentStartedAtMs: null,
    privateSpeedMps: null,
  };
}

export function resumeRecording(
  state: SessionEngineState,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (state.session.status !== 'paused' && state.session.status !== 'interrupted') {
    return state;
  }
  return {
    ...state,
    session: touch({ ...state.session, status: 'recording' }, now),
    segmentStartedAtMs: now,
    privateSpeedMps: null,
  };
}

export function endRecording(
  state: SessionEngineState,
  opts: {
    nowMs?: () => number;
    startLabel?: string | null;
    finishLabel?: string | null;
  } = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (state.session.status === 'ended' || state.session.status === 'idle') return state;
  const flushed = flushActive(state, now);
  const gpsQuality = aggregateGpsQuality(state.samples);
  const startLabel =
    opts.startLabel ??
    flushed.startLabel ??
    coarseLabel(state.samples[0] ?? null);
  const finishLabel =
    opts.finishLabel ??
    flushed.finishLabel ??
    coarseLabel(state.samples[state.samples.length - 1] ?? null);
  return {
    ...state,
    session: {
      ...flushed,
      status: 'ended',
      endedAtMs: now,
      gpsQuality,
      startLabel,
      finishLabel,
    },
    segmentStartedAtMs: null,
    privateSpeedMps: null,
  };
}

/** Coarse ~0.01° grid label — not a precise reverse-geocode / home publish. */
export function coarseLabel(sample: GpsSample | null): string | null {
  if (!sample) return null;
  return `${sample.latitude.toFixed(2)}, ${sample.longitude.toFixed(2)}`;
}

export function markPermissionDenied(
  state: SessionEngineState,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  const paused =
    state.session.status === 'recording'
      ? pauseRecording(state, { nowMs: () => now, reason: 'permission' })
      : state;
  return {
    ...paused,
    session: touch({ ...paused.session, status: 'permission_denied' }, now),
    segmentStartedAtMs: null,
    privateSpeedMps: null,
  };
}

export function markUnavailable(
  state: SessionEngineState,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  const flushed =
    state.session.status === 'recording' ? { ...state, session: flushActive(state, now) } : state;
  return {
    ...flushed,
    session: touch({ ...flushed.session, status: 'unavailable' }, now),
    segmentStartedAtMs: null,
    privateSpeedMps: null,
  };
}

/**
 * App background / process interrupt while recording.
 * Persisted status becomes `interrupted` so relaunch can recover.
 */
export function markInterrupted(
  state: SessionEngineState,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (state.session.status !== 'recording' && state.session.status !== 'paused') {
    return state;
  }
  const flushed =
    state.session.status === 'recording'
      ? flushActive(state, now)
      : state.session;
  const idFactory = opts.idFactory ?? createId;
  return {
    ...state,
    session: {
      ...flushed,
      status: 'interrupted',
      interruptionCount: flushed.interruptionCount + 1,
      updatedAtMs: now,
    },
    events: [
      ...state.events,
      {
        id: idFactory('evt'),
        sessionId: state.session.id,
        kind: 'app_interrupted',
        atMs: now,
      },
    ],
    segmentStartedAtMs: null,
    privateSpeedMps: null,
  };
}

export function applyGpsFix(
  state: SessionEngineState,
  fix: RawFix,
  opts: SessionEngineOptions = {},
): { state: SessionEngineState; result: IngestResult } {
  const idFactory = opts.idFactory ?? createId;
  const result = ingestGpsFix(state.session, state.samples, fix, idFactory);
  if (!result.accepted) {
    return { state, result };
  }

  const samples = [...state.samples, result.sample];
  let events = state.events;
  const prev = state.samples[state.samples.length - 1];
  if (prev) {
    const gap = result.sample.timestampMs - prev.timestampMs;
    if (gap > SIGNAL_LOSS_GAP_MS) {
      events = [
        ...events,
        {
          id: idFactory('evt'),
          sessionId: state.session.id,
          kind: 'signal_lost',
          atMs: prev.timestampMs,
          detail: `gap_${gap}ms`,
        },
        {
          id: idFactory('evt'),
          sessionId: state.session.id,
          kind: 'signal_recovered',
          atMs: result.sample.timestampMs,
        },
      ];
    }
  }

  const now = opts.nowMs?.() ?? Date.now();
  return {
    result,
    state: {
      ...state,
      samples,
      events,
      privateSpeedMps: result.sample.speedMps,
      session: touch(
        {
          ...state.session,
          distanceM: state.session.distanceM + result.distanceDeltaM,
          lastSampleAtMs: result.sample.timestampMs,
          gpsQuality: aggregateGpsQuality(samples),
        },
        now,
      ),
    },
  };
}

/**
 * Recover an interrupted/paused local session after relaunch.
 * Does not fabricate GPS — only restores engine state for resume/end.
 */
export function recoverInterruptedSession(
  snapshot: SessionEngineState,
  opts: { nowMs?: () => number } = {},
): { state: SessionEngineState; recoverable: boolean; reason: string } {
  const now = opts.nowMs?.() ?? Date.now();
  const { session } = snapshot;
  if (session.status === 'ended') {
    return { state: snapshot, recoverable: false, reason: 'already_ended' };
  }
  const anchor = session.updatedAtMs;
  if (now - anchor > INTERRUPT_ABANDON_MS) {
    const ended = endRecording(
      {
        ...snapshot,
        session: { ...session, status: 'paused' },
        segmentStartedAtMs: null,
      },
      { nowMs: () => now },
    );
    return { state: ended, recoverable: false, reason: 'abandoned_stale' };
  }
  if (session.status === 'interrupted' || session.status === 'paused') {
    return {
      state: {
        ...snapshot,
        session: touch({ ...session, status: 'paused' }, now),
        segmentStartedAtMs: null,
        privateSpeedMps: null,
      },
      recoverable: true,
      reason: 'resume_available',
    };
  }
  if (session.status === 'recording') {
    // Process death while "recording" → treat as interrupted then paused.
    const interrupted = markInterrupted(snapshot, { nowMs: () => now });
    return recoverInterruptedSession(interrupted, { nowMs: () => now });
  }
  return { state: snapshot, recoverable: false, reason: `status_${session.status}` };
}

export function toTripSummary(state: SessionEngineState): TripSummary | null {
  const { session, samples } = state;
  if (!session.startedAtMs) return null;
  return {
    id: session.id,
    startedAtMs: session.startedAtMs,
    endedAtMs: session.endedAtMs,
    distanceM: session.distanceM,
    durationMs: session.activeDurationMs,
    startLabel: session.startLabel,
    finishLabel: session.finishLabel,
    vehicleId: session.vehicleId,
    gpsQuality: session.gpsQuality,
    classification: session.classification,
    sampleCount: samples.length,
    status: session.status,
  };
}

/** Promote local ordinary → territory_attempt only (never verified_capture). */
export function markTerritoryAttempt(
  state: SessionEngineState,
  curatedRouteId: string,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (state.session.classification === 'verified_capture') return state;
  return {
    ...state,
    session: touch(
      {
        ...state.session,
        classification: 'territory_attempt',
        curatedRouteId,
      },
      now,
    ),
  };
}

/**
 * Attach a server-verified run id. Client cannot invent verification —
 * caller must supply an id issued by the API.
 */
export function attachServerVerifiedCapture(
  state: SessionEngineState,
  serverVerifiedRunId: string,
  opts: SessionEngineOptions = {},
): SessionEngineState {
  const now = opts.nowMs?.() ?? Date.now();
  if (!serverVerifiedRunId.trim()) return state;
  return {
    ...state,
    session: touch(
      {
        ...state.session,
        classification: 'verified_capture',
        serverVerifiedRunId,
      },
      now,
    ),
  };
}
