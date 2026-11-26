// Navigation and a focused profile can overlap briefly during a screen transition.
let guides = 0;
const listeners = new Set<() => void>();
export const guidanceActive = () => guides > 0;
export function onGuidanceStart(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function reserveGuidanceAudio() {
  guides++;
  for (const stop of listeners) stop();
  return () => {
    guides--;
  };
}
