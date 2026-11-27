import type { FinishPhotoClaim, FinishPhotoKind } from '@underground/domain';
import { exifLocation, exifTakenAt } from './finish-photo-exif';

export type CapturedFinishPhoto = { claim: FinishPhotoClaim; uri: string };

/**
 * Take (or choose) a finish photo.
 * - Camera: the claim's location is the phone's own fix at the moment of capture.
 * - Library: the claim's location and time come from the photo's EXIF.
 * The saved image is re-encoded, which drops all EXIF (including GPS), so the file that is
 * stored and uploaded never carries location. The location lives only in the private claim.
 */
export async function captureFinishPhoto(kind: FinishPhotoKind, source: 'camera' | 'library'): Promise<CapturedFinishPhoto | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-image-picker') as typeof import('expo-image-picker');
  const permission = source === 'camera'
    ? await picker.requestCameraPermissionsAsync()
    : await picker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error(source === 'camera' ? 'Camera access is off. Turn it on in Settings.' : 'Photo access is off. Turn it on in Settings.');
  const result = source === 'camera'
    ? await picker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, exif: false, allowsEditing: false })
    : await picker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, exif: true, allowsEditing: false });
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;

  let latitude: number | null = null;
  let longitude: number | null = null;
  let accuracyM: number | null = null;
  let takenAtMs = Date.now();
  if (source === 'camera') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      latitude = fix.coords.latitude;
      longitude = fix.coords.longitude;
      accuracyM = fix.coords.accuracy;
    } catch {
      // No fix: the photo is kept and the claim says so; it cannot confirm location.
    }
  } else {
    const where = exifLocation(asset.exif as Record<string, unknown> | undefined);
    latitude = where?.latitude ?? null;
    longitude = where?.longitude ?? null;
    accuracyM = where?.accuracyM ?? null;
    takenAtMs = exifTakenAt(asset.exif as Record<string, unknown> | undefined) ?? 0;
    if (!takenAtMs) throw new Error('This photo has no capture time. Take one with the camera.');
  }

  const uri = await stripAndKeep(asset.uri, kind);
  return { uri, claim: { kind, takenAtMs, latitude, longitude, accuracyM, source } };
}

/** Re-encode to JPEG (drops EXIF/GPS) and keep a private copy in the app's documents. */
async function stripAndKeep(sourceUri: string, kind: FinishPhotoKind): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const manipulator = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const stripped = await manipulator.manipulateAsync(sourceUri, [{ resize: { width: 1600 } }], {
    compress: 0.85,
    format: manipulator.SaveFormat.JPEG,
  });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('expo-file-system') as typeof import('expo-file-system');
  const dir = `${fs.documentDirectory}finish-photos/`;
  await fs.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const target = `${dir}${Date.now()}-${kind}.jpg`;
  await fs.moveAsync({ from: stripped.uri, to: target });
  return target;
}
