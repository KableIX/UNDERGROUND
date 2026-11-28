import { describe, expect, it } from 'vitest';
import { angleDelta, createTiltFilter, foilParams, TILT_RANGE_RAD } from './tilt';

function settle(f: ReturnType<typeof createTiltFilter>, beta: number, gamma: number, n = 60) {
  let t = { x: 0, y: 0 };
  for (let i = 0; i < n; i++) t = f.push(beta, gamma);
  return t;
}

describe('angleDelta', () => {
  it('takes the short way round', () => {
    expect(angleDelta(0.1, -0.1)).toBeCloseTo(0.2);
    expect(angleDelta(Math.PI - 0.05, -Math.PI + 0.05)).toBeCloseTo(-0.1);
  });
});

describe('createTiltFilter', () => {
  it('starts neutral wherever the phone is held', () => {
    const f = createTiltFilter();
    expect(f.push(1.2, 0.3)).toEqual({ x: 0, y: 0 });
    expect(settle(f, 1.2, 0.3).x).toBeCloseTo(0, 2);
  });
  it('follows roll to full tilt and no further', () => {
    const f = createTiltFilter();
    f.push(1.2, 0);
    const t = settle(f, 1.2, TILT_RANGE_RAD * 3, 20);
    expect(t.x).toBeGreaterThan(0.6);
    expect(t.x).toBeLessThanOrEqual(1);
    expect(t.y).toBeCloseTo(0, 1);
  });
  it('moves with the sign of the tilt', () => {
    const a = createTiltFilter();
    a.push(1, 0);
    const b = createTiltFilter();
    b.push(1, 0);
    expect(settle(a, 1, 0.3, 10).x).toBeGreaterThan(0);
    expect(settle(b, 1, -0.3, 10).x).toBeLessThan(0);
  });
  it('smooths a jump instead of snapping', () => {
    const f = createTiltFilter();
    f.push(1, 0);
    expect(Math.abs(f.push(1, 0.4).x)).toBeLessThan(0.3);
  });
  it('ignores sensor noise inside the dead zone', () => {
    const f = createTiltFilter();
    f.push(1, 0);
    expect(settle(f, 1, 0.004, 30).x).toBe(0);
  });
  it('ignores bad samples', () => {
    const f = createTiltFilter();
    f.push(1, 0);
    expect(f.push(Number.NaN, 0)).toEqual({ x: 0, y: 0 });
  });
  it('re-centers when the hand settles at a new angle', () => {
    const f = createTiltFilter();
    f.push(1, 0);
    const first = settle(f, 1, 0.3, 5).x;
    const later = settle(f, 1, 0.3, 2000).x;
    expect(later).toBeLessThan(first);
  });
  it('reset forgets the reference', () => {
    const f = createTiltFilter();
    f.push(1, 0);
    settle(f, 1, 0.4, 20);
    f.reset();
    expect(f.push(2, 2)).toEqual({ x: 0, y: 0 });
  });
});

describe('foilParams', () => {
  it('matte never moves', () => {
    expect(foilParams({ x: 1, y: 1 }, 'matte')).toEqual({ band: 0, glow: 0, rotX: 0, rotY: 0 });
  });
  it('holo leans and glows more than sheen', () => {
    const t = { x: 1, y: 0.5 };
    const h = foilParams(t, 'holo');
    const s = foilParams(t, 'sheen');
    expect(Math.abs(h.rotY)).toBeGreaterThan(Math.abs(s.rotY));
    expect(h.glow).toBeGreaterThan(s.glow);
    expect(h.band).toBe(1);
  });
  it('holo foil is faintly alive at rest and bright at full tilt', () => {
    expect(foilParams({ x: 0, y: 0 }, 'holo').glow).toBeCloseTo(0.25);
    expect(foilParams({ x: 1, y: 0 }, 'holo').glow).toBeCloseTo(1);
  });
  it('clamps wild input', () => {
    const p = foilParams({ x: 9, y: -9 }, 'holo');
    expect(p.band).toBe(1);
    expect(p.rotX).toBeCloseTo(7);
  });
});
