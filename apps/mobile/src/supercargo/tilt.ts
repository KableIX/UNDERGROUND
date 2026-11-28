import type { Finish } from './scan';

/*
 * Foil that follows the phone. Pure math: DeviceMotion angles in, a smoothed -1..1
 * tilt out, and from that the numbers the card uses. The reference angle is the
 * way the phone is held when the card appears, and it re-centers slowly, so the
 * light is neutral in the hand and moves only when the phone does.
 */

export type Tilt = { x: number; y: number };

export const TILT_RANGE_RAD = 0.5; // about 29 degrees of wrist roll reaches full effect
const SMOOTH = 0.16; // low-pass: lower is silkier, higher is snappier
const RECENTER = 0.0025; // per sample drift of the reference toward the hand
const DEADZONE = 0.025;

const clamp = (v: number, lo = -1, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Shortest signed distance between two angles in radians. */
export function angleDelta(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export function createTiltFilter(range = TILT_RANGE_RAD) {
  let ref: { beta: number; gamma: number } | null = null;
  let out: Tilt = { x: 0, y: 0 };
  return {
    /** beta: front-back pitch, gamma: left-right roll, both in radians (DeviceMotion.rotation). */
    push(beta: number, gamma: number): Tilt {
      if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return out;
      if (!ref) ref = { beta, gamma };
      const dx = angleDelta(gamma, ref.gamma);
      const dy = angleDelta(beta, ref.beta);
      // Follow the hand slowly so a new resting angle becomes neutral.
      ref = { beta: ref.beta + dy * RECENTER, gamma: ref.gamma + dx * RECENTER };
      const tx = Math.abs(dx / range) < DEADZONE ? 0 : clamp(dx / range);
      const ty = Math.abs(dy / range) < DEADZONE ? 0 : clamp(dy / range);
      out = { x: out.x + (tx - out.x) * SMOOTH, y: out.y + (ty - out.y) * SMOOTH };
      return out;
    },
    reset() {
      ref = null;
      out = { x: 0, y: 0 };
    },
  };
}

export type FoilParams = {
  /** -1..1 where the light band sits across the card. */
  band: number;
  /** 0..1 strength of the specular glow. */
  glow: number;
  /** Degrees of card lean. */
  rotX: number;
  rotY: number;
};

const REACH: Record<Finish, { rotate: number; glow: number }> = {
  holo: { rotate: 7, glow: 1 },
  sheen: { rotate: 3, glow: 0.55 },
  matte: { rotate: 0, glow: 0 },
};

export function foilParams(t: Tilt, finish: Finish): FoilParams {
  const r = REACH[finish];
  if (r.glow === 0) return { band: 0, glow: 0, rotX: 0, rotY: 0 };
  const mag = Math.min(1, Math.hypot(t.x, t.y));
  return {
    band: clamp(t.x),
    // Never fully dark: the foil is always faintly alive, brighter as it catches the light.
    glow: r.glow * (0.25 + 0.75 * mag),
    rotX: -clamp(t.y) * r.rotate,
    rotY: clamp(t.x) * r.rotate,
  };
}
