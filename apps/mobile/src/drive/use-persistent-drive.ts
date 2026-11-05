import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  applyGpsFix,
  createSessionEngine,
  endRecording,
  FOREGROUND_DISTANCE_INTERVAL_M,
  FOREGROUND_TIME_INTERVAL_MS,
  markInterrupted,
  markPermissionDenied,
  markUnavailable,
  pauseRecording,
  recoverInterruptedSession,
  resumeRecording,
  startRecording,
  type SessionEngineState,
  type TripSummary,
} from '@underground/drive-tracking';
import { getTripStore } from './trip-store';

type LocationSubscription = { remove(): void };

export type PersistentDriveControls = {
  state: SessionEngineState;
  summary: TripSummary | null;
  /** Private live speed (m/s) — UI may show locally; never analytics. */
  privateSpeedMps: number | null;
  recovering: boolean;
  start: (opts?: { vehicleId?: string | null }) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  refreshRecoverable: () => Promise<void>;
};

/**
 * Foreground persistent drive recorder.
 * - Persists to local SQLite (survive network loss / relaunch)
 * - Auto-pauses on AppState inactive and lost permissions
 * - Does not enable background location entitlements
 * - Does not award ownership or CLOUT
 */
export function usePersistentDrive(): PersistentDriveControls {
  const [state, setState] = useState<SessionEngineState>(() => createSessionEngine());
  const [recovering, setRecovering] = useState(true);
  const stateRef = useRef(state);
  const sub = useRef<LocationSubscription | null>(null);
  const persistTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const persist = useCallback(async (next: SessionEngineState) => {
    try {
      await getTripStore().saveSession(next);
    } catch {
      // Local persistence failure must not crash the recorder.
    }
  }, []);

  const releaseWatch = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
  }, []);

  const clearPersistTimer = useCallback(() => {
    if (persistTimer.current) {
      clearInterval(persistTimer.current);
      persistTimer.current = null;
    }
  }, []);

  const watchPosition = useCallback(async () => {
    releaseWatch();
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      sub.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: FOREGROUND_TIME_INTERVAL_MS,
          distanceInterval: FOREGROUND_DISTANCE_INTERVAL_M,
        },
        fix => {
          const { latitude, longitude, accuracy, speed, altitude, heading } = fix.coords;
          const applied = applyGpsFix(stateRef.current, {
            timestampMs: fix.timestamp,
            latitude,
            longitude,
            altitudeM: altitude,
            accuracyM: accuracy,
            speedMps: speed,
            headingDeg: heading,
          });
          if (!applied.result.accepted) return;
          stateRef.current = applied.state;
          setState(applied.state);
        },
      );
    } catch {
      const next = markUnavailable(stateRef.current);
      stateRef.current = next;
      setState(next);
      await persist(next);
    }
  }, [persist, releaseWatch]);

  const start = useCallback(
    async (opts?: { vehicleId?: string | null }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Location = require('expo-location') as typeof import('expo-location');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          const denied = markPermissionDenied(stateRef.current);
          stateRef.current = denied;
          setState(denied);
          await persist(denied);
          return;
        }
        let next =
          stateRef.current.session.status === 'paused' ||
          stateRef.current.session.status === 'interrupted'
            ? resumeRecording(stateRef.current)
            : startRecording(
                createSessionEngine({
                  vehicleId: opts?.vehicleId ?? null,
                }),
              );
        if (opts?.vehicleId && next.session.vehicleId !== opts.vehicleId) {
          next = {
            ...next,
            session: { ...next.session, vehicleId: opts.vehicleId },
          };
        }
        stateRef.current = next;
        setState(next);
        await persist(next);
        await watchPosition();
        clearPersistTimer();
        persistTimer.current = setInterval(() => {
          void persist(stateRef.current);
        }, 8_000);
      } catch {
        const next = markUnavailable(stateRef.current);
        stateRef.current = next;
        setState(next);
        await persist(next);
      }
    },
    [clearPersistTimer, persist, watchPosition],
  );

  const pause = useCallback(async () => {
    releaseWatch();
    clearPersistTimer();
    const next = pauseRecording(stateRef.current, { reason: 'user' });
    stateRef.current = next;
    setState(next);
    await persist(next);
  }, [clearPersistTimer, persist, releaseWatch]);

  const resume = useCallback(async () => {
    await start();
  }, [start]);

  const end = useCallback(async () => {
    releaseWatch();
    clearPersistTimer();
    const next = endRecording(stateRef.current);
    stateRef.current = next;
    setState(next);
    await persist(next);
  }, [clearPersistTimer, persist, releaseWatch]);

  const refreshRecoverable = useCallback(async () => {
    setRecovering(true);
    try {
      const found = await getTripStore().findRecoverableSession();
      if (!found) {
        setRecovering(false);
        return;
      }
      const recovered = recoverInterruptedSession(found);
      stateRef.current = recovered.state;
      setState(recovered.state);
      await persist(recovered.state);
    } finally {
      setRecovering(false);
    }
  }, [persist]);

  useEffect(() => {
    void refreshRecoverable();
  }, [refreshRecoverable]);

  // Foreground-only: pause when leaving active. No background entitlement used.
  useEffect(() => {
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && stateRef.current.session.status === 'recording') {
        releaseWatch();
        clearPersistTimer();
        const next = markInterrupted(stateRef.current);
        stateRef.current = next;
        setState(next);
        void persist(next);
      }
    });
    return () => listener.remove();
  }, [clearPersistTimer, persist, releaseWatch]);

  useEffect(
    () => () => {
      releaseWatch();
      clearPersistTimer();
    },
    [clearPersistTimer, releaseWatch],
  );

  // Tick active duration display while recording.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.session.status !== 'recording') return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [state.session.status]);

  const liveDuration =
    state.session.activeDurationMs +
    (state.session.status === 'recording' && state.segmentStartedAtMs
      ? Math.max(0, Date.now() - state.segmentStartedAtMs)
      : 0);

  const summary: TripSummary | null = state.session.startedAtMs
    ? {
        id: state.session.id,
        startedAtMs: state.session.startedAtMs,
        endedAtMs: state.session.endedAtMs,
        distanceM: state.session.distanceM,
        durationMs: liveDuration,
        startLabel: state.session.startLabel,
        finishLabel: state.session.finishLabel,
        vehicleId: state.session.vehicleId,
        gpsQuality: state.session.gpsQuality,
        classification: state.session.classification,
        sampleCount: state.samples.length,
        status: state.session.status,
      }
    : null;

  return {
    state,
    summary,
    privateSpeedMps: state.privateSpeedMps,
    recovering,
    start,
    pause,
    resume,
    end,
    refreshRecoverable,
  };
}
