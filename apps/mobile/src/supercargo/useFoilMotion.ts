import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { loadSensors } from './native';
import type { Finish } from './scan';
import { createTiltFilter, foilParams } from './tilt';

/** Animated values a card reads. Driven by the phone's motion; set from JS, consumed natively. */
export type FoilMotion = {
  band: Animated.Value;
  glow: Animated.Value;
  rotX: Animated.Value;
  rotY: Animated.Value;
};

/**
 * Subscribes to device motion while `active` and the finish has foil. Returns null
 * when there is nothing to follow (no sensors module in this build, no motion
 * hardware, matte finish, or inactive), so the card keeps its drifting foil.
 */
export function useFoilMotion(finish: Finish, active: boolean): FoilMotion | null {
  const values = useRef<FoilMotion>({
    band: new Animated.Value(0),
    glow: new Animated.Value(0.25),
    rotX: new Animated.Value(0),
    rotY: new Animated.Value(0),
  }).current;
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(false);
    if (!active || finish === 'matte') return;
    const sensors = loadSensors();
    if (!sensors) return;
    const { DeviceMotion } = sensors;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;
    const filter = createTiltFilter();
    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync())) return;
        DeviceMotion.setUpdateInterval(33);
        sub = DeviceMotion.addListener((m) => {
          const r = m.rotation;
          if (!r) return;
          const p = foilParams(filter.push(r.beta, r.gamma), finish);
          values.band.setValue(p.band);
          values.glow.setValue(p.glow);
          values.rotX.setValue(p.rotX);
          values.rotY.setValue(p.rotY);
        });
        if (!cancelled) setLive(true);
        else sub.remove();
      } catch {
        // No sensors: the drifting foil stays.
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
      setLive(false);
    };
  }, [active, finish, values]);

  return live ? values : null;
}
