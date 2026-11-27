import { describe, expect, it } from 'vitest';
import { exifLocation, exifTakenAt } from './finish-photo-exif';

describe('finish photo EXIF', () => {
  it('reads iOS nested GPS with hemisphere refs', () => {
    expect(exifLocation({ '{GPS}': { Latitude: 36.27, LatitudeRef: 'N', Longitude: 121.8, LongitudeRef: 'W', HPositioningError: 5 } }))
      .toEqual({ latitude: 36.27, longitude: -121.8, accuracyM: 5 });
  });
  it('reads Android flat GPS and DMS strings', () => {
    const where = exifLocation({ GPSLatitude: 33.5, GPSLatitudeRef: 'S', GPSLongitude: '151,12,36', GPSLongitudeRef: 'E' });
    expect(where?.latitude).toBe(-33.5);
    expect(where?.longitude).toBeCloseTo(151.21, 6);
    expect(where?.accuracyM).toBeNull();
  });
  it('treats missing or null-island GPS as no location', () => {
    expect(exifLocation(undefined)).toBeNull();
    expect(exifLocation({})).toBeNull();
    expect(exifLocation({ GPSLatitude: 0, GPSLongitude: 0 })).toBeNull();
  });
  it('reads capture time with and without an offset', () => {
    expect(exifTakenAt({ '{Exif}': { DateTimeOriginal: '2026:11:27 08:00:00', OffsetTimeOriginal: '-08:00' } }))
      .toBe(Date.UTC(2026, 10, 27, 16, 0, 0));
    expect(exifTakenAt({ DateTimeOriginal: '2026:11:27 08:00:00' })).toBe(new Date(2026, 10, 27, 8, 0, 0).getTime());
    expect(exifTakenAt({ DateTimeOriginal: 'yesterday' })).toBeNull();
  });
});
