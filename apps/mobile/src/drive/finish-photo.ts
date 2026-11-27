import type { FinishPhotoClaim, FinishPhotoKind } from '@underground/domain';
import { decode } from 'base64-arraybuffer';
import { sha256Hex } from '../lib/sha256';
import { exifLocation, exifTakenAt } from './finish-photo-exif';

export type CapturedFinishPhoto = { claim: FinishPhotoClaim; uri: string; imageSha256: string | null };

/**
 * Take (or choose) a finish photo.
 * - Camera: the claim's location is the phone's own fix at the moment of capture.
 * - Library: the claim's location and time come from the photo's EXIF.
 * The saved image is re-encoded, which drops all EXIF (including GPS), and kept only on
 * this phone (app documents). It is never uploaded. The server gets a non-image proof:
 * capture time, the GPS fix (deleted once the finish is accepted) and the image's SHA-256.
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
  return { uri, imageSha256: await hashFile(uri), claim: { kind, takenAtMs, latitude, longitude, accuracyM, source } };
}

/** SHA-256 of the stripped file, so the same photo cannot credit two runs. Null if unreadable. */
async function hashFile(uri: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as typeof import('expo-file-system');
    const base64 = await fs.readAsStringAsync(uri, { encoding: fs.EncodingType.Base64 });
    return sha256Hex(new Uint8Array(decode(base64)));
  } catch {
    return null;
  }
}

/** Re-encode to JPEG (drops EXIF/GPS) and keep the only copy in the app's documents on this phone. */
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
