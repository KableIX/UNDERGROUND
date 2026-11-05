const EARTH_RADIUS_M = 6_371_008.8;

export function haversineM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLng = (bLng - aLng) * toRad;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Project lon/lat into a unit square for mini-map polylines (no tiling). */
export function projectToUnitSquare(
  points: ReadonlyArray<{ latitude: number; longitude: number }>,
): Array<{ x: number; y: number }> {
  if (points.length === 0) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLng = Math.min(minLng, p.longitude);
    maxLng = Math.max(maxLng, p.longitude);
  }
  const latSpan = Math.max(1e-9, maxLat - minLat);
  const lngSpan = Math.max(1e-9, maxLng - minLng);
  const pad = 0.08;
  return points.map(p => ({
    x: pad + (1 - 2 * pad) * ((p.longitude - minLng) / lngSpan),
    y: pad + (1 - 2 * pad) * (1 - (p.latitude - minLat) / latSpan),
  }));
}
