import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

export type MapPosition = {
  longitude: number;
  latitude: number;
  accuracyM: number | null;
  timestamp: number;
};

export type MapLocationStatus = 'requesting' | 'granted' | 'denied' | 'unavailable';

type Subscription = { remove: () => void };

function validPosition(position: MapPosition): boolean {
  return Number.isFinite(position.latitude) && Number.isFinite(position.longitude) &&
    Math.abs(position.latitude) <= 90 && Math.abs(position.longitude) <= 180;
}

/** Foreground-only location for displaying the user's position on the map.
 * Does not record a drive, upload GPS, or award any territory ownership.
 */
export function useMapLocation() {
  const [status, setStatus] = useState<MapLocationStatus>('requesting');
  const [position, setPosition] = useState<MapPosition | null>(null);
  const subRef = useRef<Subscription | null>(null);
  const generationRef = useRef(0);

  const stopWatching = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    generationRef.current += 1;
  }, []);

  const startWatching = useCallback(async () => {
    stopWatching();
    const generation = generationRef.current;
    try {
      // Guard against an older installed iOS development binary without expo-location.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const permission = await Location.requestForegroundPermissionsAsync();
      if (generation !== generationRef.current) return;
      if (permission.status !== 'granted') {
        setStatus('denied');
        return;
      }
      setStatus('granted');

      const accept = (fix: import('expo-location').LocationObject) => {
        if (generation !== generationRef.current) return;
        const next = {
          longitude: fix.coords.longitude,
          latitude: fix.coords.latitude,
          accuracyM: fix.coords.accuracy,
          timestamp: fix.timestamp,
        };
        // A low-accuracy fix is still preferable to an unrelated default-city camera.
        // Display its accuracy separately; never use these fixes for conquest adjudication.
        if (validPosition(next)) {
          setPosition(previous => previous && next.timestamp < previous.timestamp ? previous : next);
        }
      };

      // Last known position speeds up initial centering; must be recent and accurate.
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 120_000,
          requiredAccuracy: 200,
        });
        if (lastKnown) accept(lastKnown);
      } catch { /* A cache miss cannot prevent live positioning. */ }

      // Don't block the GPS watch while waiting for a high-quality first fix.
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then(accept)
        .catch(() => undefined);

      if (generation !== generationRef.current) return;
      const subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 10,
        timeInterval: 4000,
      }, accept);
      if (generation !== generationRef.current) {
        subscription.remove();
      } else {
        subRef.current = subscription;
      }
    } catch {
      if (generation === generationRef.current) setStatus('unavailable');
    }
  }, [stopWatching]);

  useFocusEffect(useCallback(() => {
    void startWatching();
    const listener = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        stopWatching();
      } else {
        void startWatching();
      }
    });
    return () => {
      listener.remove();
      stopWatching();
    };
  }, [startWatching, stopWatching]));

  return { status, position, retry: startWatching };
}
