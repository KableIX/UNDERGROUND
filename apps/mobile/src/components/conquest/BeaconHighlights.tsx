import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { BeaconLight } from './MapBeacon';

export type Highlight = { id: string; latitude: number; longitude: number; location?: boolean };
type Pixel = { x: number; y: number };
type Projector = { pointForCoordinate: (pin: Highlight) => Promise<Pixel> };
export type HighlightControls = { refresh(): void };

// MapKit projects the actual pitched and rotated map. Draw just the emissive
// part above the screen tint; native annotations keep their labels and taps.
export const BeaconHighlights = forwardRef<HighlightControls, {
  map: RefObject<Projector | null>; pins: Highlight[];
}>(function BeaconHighlights({ map, pins }, ref) {
  const [lights, setLights] = useState<(Highlight & Pixel)[]>([]);
  const controls = useRef<HighlightControls>({ refresh() {} });
  useImperativeHandle(ref, () => ({ refresh: () => controls.current.refresh() }), []);
  useEffect(() => {
    let alive = true;
    let pending = false;
    let again = false;
    async function refresh() {
      if (!alive || !map.current) return;
      if (pending) { again = true; return; }
      pending = true;
      const nativeMap = map.current;
      const positions = await Promise.all(pins.map(async pin => {
        try {
          const { x, y } = await nativeMap.pointForCoordinate(pin);
          return Number.isFinite(x) && Number.isFinite(y) ? { ...pin, x, y } : null;
        } catch { return null; }
      }));
      if (!alive) return;
      setLights(positions.filter((p): p is Highlight & Pixel => p !== null));
      pending = false;
      if (again) { again = false; void refresh(); }
    }
    controls.current = { refresh };
    void refresh();
    return () => { alive = false; };
  }, [pins, map]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} onLayout={() => controls.current.refresh()}>
    {lights.map(pin => <View key={pin.id} style={{ position: 'absolute', left: pin.x - 54, top: pin.y - 84, width: 108, height: 132 }}>
      <BeaconLight location={!!pin.location} />
    </View>)}
  </View>;
});
