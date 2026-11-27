/**
 * Read where and when a library photo was taken from its EXIF, as returned by
 * expo-image-picker (iOS nests {GPS}/{Exif}; Android uses flat GPSLatitude keys).
 * Pure: no React Native imports, so it is unit-tested in Node.
 */
type Exif = Record<string, unknown> | null | undefined;

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Degrees from a number, "deg,min,sec" string, or [deg,min,sec] array. */
function degrees(value: unknown): number | null {
  const direct = num(value);
  if (direct != null) return direct;
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[ ,/]+/) : null;
  if (!parts || parts.length < 1) return null;
  const [d, m = 0, s = 0] = parts.map(num);
  if (d == null || m == null || s == null) return null;
  return d + m / 60 + s / 3600;
}

export function exifLocation(exif: Exif): { latitude: number; longitude: number; accuracyM: number | null } | null {
  if (!exif) return null;
  const gps = (exif['{GPS}'] as Record<string, unknown> | undefined) ?? null;
  const lat = degrees(gps ? gps.Latitude : exif.GPSLatitude);
  const lng = degrees(gps ? gps.Longitude : exif.GPSLongitude);
  if (lat == null || lng == null) return null;
  const latRef = String((gps ? gps.LatitudeRef : exif.GPSLatitudeRef) ?? 'N').toUpperCase();
  const lngRef = String((gps ? gps.LongitudeRef : exif.GPSLongitudeRef) ?? 'E').toUpperCase();
  const latitude = latRef === 'S' ? -Math.abs(lat) : lat;
  const longitude = lngRef === 'W' ? -Math.abs(lng) : lng;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  const accuracyM = num(gps ? gps.HPositioningError : exif.GPSHPositioningError);
  return { latitude, longitude, accuracyM };
}

/**
 * Capture time in epoch ms. Uses OffsetTimeOriginal when present; otherwise the
 * device's local zone (EXIF DateTimeOriginal carries no zone).
 */
export function exifTakenAt(exif: Exif): number | null {
  if (!exif) return null;
  const inner = (exif['{Exif}'] as Record<string, unknown> | undefined) ?? exif;
  const raw = inner.DateTimeOriginal ?? inner.DateTimeDigitized ?? exif.DateTime;
  if (typeof raw !== 'string') return null;
  const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(raw.trim());
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match.map(Number) as number[];
  const offset = inner.OffsetTimeOriginal ?? inner.OffsetTime;
  const zone = typeof offset === 'string' ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null;
  if (zone) {
    const sign = zone[1] === '-' ? -1 : 1;
    const offsetMs = sign * (Number(zone[2]) * 60 + Number(zone[3])) * 60_000;
    return Date.UTC(y!, mo! - 1, d!, h!, mi!, s!) - offsetMs;
  }
  const local = new Date(y!, mo! - 1, d!, h!, mi!, s!).getTime();
  return Number.isFinite(local) ? local : null;
}
