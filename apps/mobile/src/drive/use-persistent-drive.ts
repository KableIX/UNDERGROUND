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
import {
  isBackgroundDriveRunning,
  onDriveFixes,
  startBackgroundDrive,
  stopBackgroundDrive,
  type DriveFix,
} from './background-location';

type LocationSubscription = { remove(): void };

export type PersistentDriveControls = {
  state: SessionEngineState;
  summary: TripSummary | null;
  /** Private live speed (m/s) — UI may show locally; never analytics. */
  privateSpeedMps: number | null;
  recovering: boolean;
  /** True while background GPS is on: recording continues with the phone locked. */
  background: boolean;
  start: (opts?: { vehicleId?: string | null; vehicleLabel?: string | null; curatedRouteId?: string }) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the recording and returns the saved state (for run analytics). */
  end: () => Promise<SessionEngineState>;
  refreshRecoverable: () => Promise<void>;
};

/**
 * Persistent drive recorder.
 * - Persists to local SQLite (survive network loss / relaunch)
 * - Keeps recording with the phone locked when "Always" location is granted
 *   (background task, see background-location.ts); otherwise pauses on lock as before
 * - Does not award ownership or CLOUT
 */
export function usePersistentDrive(): PersistentDriveControls {
  const [state, setState] = useState<SessionEngineState>(() => createSessionEngine());
  const [recovering, setRecovering] = useState(true);
  const stateRef = useRef(state);
  const sub = useRef<LocationSubscription | null>(null);
  const persistTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [background, setBackground] = useState(false);
  const backgroundRef = useRef(false);
  const lastPersistAt = useRef(0);

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

  const setBackgroundOn = useCallback((on: boolean) => {
    backgroundRef.current = on;
    setBackground(on);
  }, []);

  /** Apply real fixes from either the foreground watch or the background task. */
  const applyFixes = useCallback((fixes: DriveFix[]) => {
    let next = stateRef.current;
    for (const fix of fixes) {
      const applied = applyGpsFix(next, fix);
      if (applied.result.accepted) next = applied.state;
    }
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
    // Timers are unreliable while locked; persist from the fix stream as well.
    const now = Date.now();
    if (backgroundRef.current && now - lastPersistAt.current > 8_000) {
      lastPersistAt.current = now;
      void persist(next);
    }
  }, [persist]);

  useEffect(() => onDriveFixes(applyFixes), [applyFixes]);

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
          applyFixes([{
            timestampMs: fix.timestamp,
            latitude,
            longitude,
            altitudeM: altitude,
            accuracyM: accuracy,
            speedMps: speed,
            headingDeg: heading,
          }]);
        },
      );
    } catch {
      const next = markUnavailable(stateRef.current);
      stateRef.current = next;
      setState(next);
      await persist(next);
    }
  }, [applyFixes, persist, releaseWatch]);

  const start = useCallback(
    async (opts?: { vehicleId?: string | null; vehicleLabel?: string | null; curatedRouteId?: string }) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Location = require('expo-location') as typeof import('expo-location');
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          const denied = markPermissionDenied(stateRef.current);
          stateRef.current = denied;
          setState(denied);
          await persist(denied);
          return false;
        }
        let next =
          stateRef.current.session.status === 'paused' ||
          stateRef.current.session.status === 'interrupted'
            ? resumeRecording(stateRef.current)
            : startRecording(
                createSessionEngine({
                  vehicleId: opts?.vehicleId ?? null,
                  vehicleLabel: opts?.vehicleLabel, curatedRouteId:opts?.curatedRouteId,
                }),
              );
        stateRef.current = next;
        setState(next);
        await persist(next);
        await watchPosition();
        // Ask for "Always" once; declining keeps the old foreground-only behaviour.
        setBackgroundOn(await startBackgroundDrive());
        clearPersistTimer();
        persistTimer.current = setInterval(() => {
          void persist(stateRef.current);
        }, 8_000);
        return stateRef.current.session.status === 'recording';
      } catch {
        const next = markUnavailable(stateRef.current);
        stateRef.current = next;
        setState(next);
        await persist(next);
        return false;
      }
    },
    [clearPersistTimer, persist, setBackgroundOn, watchPosition],
  );

  const pause = useCallback(async () => {
    releaseWatch();
    clearPersistTimer();
    await stopBackgroundDrive();
    setBackgroundOn(false);
    const next = pauseRecording(stateRef.current, { reason: 'user' });
    stateRef.current = next;
    setState(next);
    await persist(next);
  }, [clearPersistTimer, persist, releaseWatch, setBackgroundOn]);

  const resume = useCallback(async () => {
    await start();
  }, [start]);

  const end = useCallback(async () => {
    releaseWatch();
    clearPersistTimer();
    await stopBackgroundDrive();
    setBackgroundOn(false);
    const next = endRecording(stateRef.current);
    stateRef.current = next;
    setState(next);
    await persist(next);
    return next;
  }, [clearPersistTimer, persist, releaseWatch, setBackgroundOn]);

  const refreshRecoverable = useCallback(async () => {
    setRecovering(true);
    try {
      const found = await getTripStore().findRecoverableSession();
      if (!found) {
        setRecovering(false);
        return;
      }
      // Background GPS kept this recording alive while the app was closed: carry on.
      if (found.session.status === 'recording' && (await isBackgroundDriveRunning())) {
        stateRef.current = found;
        setState(found);
        setBackgroundOn(true);
        await watchPosition();
        clearPersistTimer();
        persistTimer.current = setInterval(() => {
          void persist(stateRef.current);
        }, 8_000);
        return;
      }
      await stopBackgroundDrive();
      const recovered = recoverInterruptedSession(found);
      stateRef.current = recovered.state;
      setState(recovered.state);
      await persist(recovered.state);
    } finally {
      setRecovering(false);
    }
  }, [clearPersistTimer, persist, setBackgroundOn, watchPosition]);

  useEffect(() => {
    void refreshRecoverable();
  }, [refreshRecoverable]);

  // Without background GPS, leaving the foreground interrupts the recording (old behaviour).
  // With it, the background task keeps feeding fixes and nothing is interrupted.
  useEffect(() => {
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && stateRef.current.session.status === 'recording') {
        if (backgroundRef.current) {
          void persist(stateRef.current);
          return;
        }
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
        vehicleLabel: state.session.vehicleLabel,
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
    background,
    start,
    pause,
    resume,
    end,
    refreshRecoverable,
  };
}
