import florida from './florida-boundary.json';

type Point = readonly number[];
type Fix = { longitude: number; latitude: number; accuracy: number | null; timestamp: number };

function insideRing(x: number, y: number, ring: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// US Census TIGERweb state geometry includes the Keys and their connecting waters.
export function floridaAccess(fix: Fix | null, now: number): 'inside' | 'away' | 'unknown' {
  if (!fix || !Number.isFinite(fix.longitude) || !Number.isFinite(fix.latitude) ||
      Math.abs(fix.longitude) > 180 || Math.abs(fix.latitude) > 90 ||
      !Number.isFinite(fix.timestamp) || fix.timestamp > now || now - fix.timestamp > 90_000 ||
      fix.accuracy === null || !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 500) return 'unknown';
  const { longitude: x, latitude: y } = fix;
  const inside = florida.some(([outer, ...holes]) =>
    insideRing(x, y, outer) && !holes.some(hole => insideRing(x, y, hole)));
  return inside ? 'inside' : 'away';
}
