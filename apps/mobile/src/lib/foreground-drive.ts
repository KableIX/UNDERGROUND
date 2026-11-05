import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

type LocationPoint = { latitude: number; longitude: number; accuracyM: number | null; timestamp: number };
type DriveStatus = 'idle' | 'recording' | 'paused' | 'finished' | 'permission_denied' | 'unavailable';
type LocationSubscription = { remove(): void };

export type ForegroundDriveState = {
  status: DriveStatus;
  points: number;
  distanceM: number;
  elapsedSeconds: number;
  accuracyM: number | null;
  speedKph: number | null;
  currentPosition: LocationPoint | null;
};
const MAX_POINTS = 20000;
const EARTH_RADIUS_M = 6371008.8;

function haversineM(a: LocationPoint, b: LocationPoint): number {
  const toRad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * toRad;
  const dLng = (b.longitude - a.longitude) * toRad;
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(a.latitude * toRad) * Math.cos(b.latitude * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Foreground-only trip recorder. Not server-verified, not persistence or conquest evidence. */
export function useForegroundDrive() {
  const [status, setStatus] = useState<DriveStatus>('idle');
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [speedKph, setSpeedKph] = useState<number | null>(null);
  const sub = useRef<LocationSubscription | null>(null);
  const startMs = useRef<number | null>(null);
  const priorElapsed = useRef(0);

  const release = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
  }, []);

  const pause = useCallback(() => {
    release();
    if (startMs.current !== null) {
      priorElapsed.current += Math.max(0, Date.now() - startMs.current);
      startMs.current = null;
    }
    setStatus('paused');
    setSpeedKph(null);
  }, [release]);

  const finish = useCallback(() => {
    release();
    if (startMs.current !== null) {
      priorElapsed.current += Math.max(0, Date.now() - startMs.current);
      startMs.current = null;
    }
    setElapsedSeconds(Math.floor(priorElapsed.current / 1000));
    setStatus('finished');
    setSpeedKph(null);
  }, [release]);

  const start = useCallback(async () => {
    try {
      // Lazily require native code so old binaries cannot crash at module import time.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setStatus('permission_denied');
        return;
      }
      release();
      if (status !== 'paused') {
        setPoints([]);
        setElapsedSeconds(0);
        priorElapsed.current = 0;
      }
      startMs.current = Date.now();
      sub.current = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1500,
        distanceInterval: 5,
      }, fix => {
        const { latitude, longitude, accuracy, speed } = fix.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const point = { latitude, longitude, accuracyM: accuracy, timestamp: fix.timestamp };
        setPoints(previous => {
          if (previous.length >= MAX_POINTS) return previous;
          const last = previous[previous.length - 1];
          if (last && point.timestamp <= last.timestamp) return previous;
          return [...previous, point];
        });
        setSpeedKph(speed !== null && Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : null);
      });
      setStatus('recording');
    } catch {
      release();
      startMs.current = null;
      setStatus('unavailable');
    }
  }, [release, status]);

  useEffect(() => {
    if (status !== 'recording') return;
    const update = () => setElapsedSeconds(Math.floor((priorElapsed.current + (Date.now() - (startMs.current ?? Date.now()))) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => () => release(), [release]);
  // This build intentionally has no background recording entitlement or task.
  useEffect(() => {
    const listener = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && status === 'recording') pause();
    });
    return () => listener.remove();
  }, [status, pause]);

  const distanceM = points.reduce((sum, point, index) => {
    const previous = points[index - 1];
    if (!previous || point.accuracyM == null || point.accuracyM > 75) return sum;
    const segment = haversineM(previous, point);
    // Ignore discontinuities for private display; no authoritative adjudication here.
    const dt = (point.timestamp - previous.timestamp) / 1000;
    return dt > 0 && segment / dt < 85 ? sum + segment : sum;
  }, 0);

  return {
    status,
    points: points.length,
    distanceM,
    elapsedSeconds,
    accuracyM: points[points.length - 1]?.accuracyM ?? null,
    speedKph,
    currentPosition: points[points.length - 1] ?? null,
    start, pause, finish,
  };
}
