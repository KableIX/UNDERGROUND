import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { mapLighting } from './map-lighting';

type Center = { latitude: number; longitude: number };

export function useMapLighting(initialCenter: Center) {
  const [viewport, setViewport] = useState<Center | null>(null);
  const [now, setNow] = useState(Date.now);
  const { latitude, longitude } = viewport ?? initialCenter;
  const reportCenter = useCallback((center: Center) => {
    if (!Number.isFinite(center.latitude) || Math.abs(center.latitude) > 90 || !Number.isFinite(center.longitude)) return;
    setViewport(previous => previous && Math.abs(previous.latitude - center.latitude) < 0.01 &&
      Math.abs(previous.longitude - center.longitude) < 0.01 ? previous : { latitude: center.latitude, longitude: center.longitude });
  }, []);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;
    function onState(state: string) {
      clearInterval(timer);
      if (state === 'active') {
        refresh();
        timer = setInterval(refresh, 60000);
      }
    }
    onState(AppState.currentState ?? 'active');
    const sub = AppState.addEventListener('change', onState);
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  const lighting = useMemo(() => mapLighting(latitude, longitude, now), [latitude, longitude, now]);
  return { lighting, reportCenter };
}
