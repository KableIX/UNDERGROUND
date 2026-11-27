import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { floridaAccess } from '../data/florida-access';

type Access = ReturnType<typeof floridaAccess> | 'denied';

async function locate(ask: boolean): Promise<Access> {
  try {
    const Location = require('expo-location') as typeof import('expo-location');
    let permission = await Location.getForegroundPermissionsAsync();
    if (ask && !permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return permission.canAskAgain ? 'unknown' : 'denied';
    const cached = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 500 });
    const classify = (p: import('expo-location').LocationObject | null) => floridaAccess(
      p && { ...p.coords, timestamp: p.timestamp }, Date.now());
    const last = classify(cached);
    if (last !== 'unknown') return last;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const current = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 10_000); }),
      ]);
      return classify(current);
    } finally { clearTimeout(timer); }
  } catch { return 'unknown'; }
}

export function useFloridaAccess(enabled: boolean) {
  const [access, setAccess] = useState<Access>('unknown');
  const [checking, setChecking] = useState(false);
  const version = useRef(0);
  const check = useCallback(async (ask = false) => {
    if (!enabled) return false;
    const current = ++version.current;
    setChecking(true);
    const result = await locate(ask);
    if (current !== version.current) return false;
    setAccess(result);
    setChecking(false);
    return result === 'inside';
  }, [enabled]);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    void check();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void check();
    });
    return () => { version.current++; sub.remove(); };
  }, [enabled, check]));
  return { access, checking, check };
}
