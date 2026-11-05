export type LonLat = readonly [number, number];

export type GeoBounds = {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
};

export type ProjectedPoint = { x: number; y: number };

/** Compute padded bounding box from LineString coordinates. */
export function boundsFromLineStrings(
  lines: LonLat[][],
  padFraction = 0.12,
): GeoBounds {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const line of lines) {
    for (const [lon, lat] of line) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  if (!Number.isFinite(minLon)) {
    return { minLon: -122, maxLon: -121.8, minLat: 37.3, maxLat: 37.45 };
  }
  const lonPad = (maxLon - minLon) * padFraction || 0.02;
  const latPad = (maxLat - minLat) * padFraction || 0.02;
  return {
    minLon: minLon - lonPad,
    maxLon: maxLon + lonPad,
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
  };
}

/**
 * Project WGS84 lon/lat into view coordinates (y grows downward).
 * Simple equirectangular — enough for district-scale tactical overlay.
 */
export function projectLonLat(
  lon: number,
  lat: number,
  bounds: GeoBounds,
  width: number,
  height: number,
  inset = 16,
): ProjectedPoint {
  const usableW = Math.max(1, width - inset * 2);
  const usableH = Math.max(1, height - inset * 2);
  const xNorm = (lon - bounds.minLon) / (bounds.maxLon - bounds.minLon || 1);
  const yNorm = (bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat || 1);
  return {
    x: inset + xNorm * usableW,
    y: inset + yNorm * usableH,
  };
}

export function projectLine(
  coords: LonLat[],
  bounds: GeoBounds,
  width: number,
  height: number,
): ProjectedPoint[] {
  return coords.map(([lon, lat]) => projectLonLat(lon, lat, bounds, width, height));
}
