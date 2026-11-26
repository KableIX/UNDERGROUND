import { publicEnv } from '../lib/env';
import { getMobileSupabaseClient } from '../session/supabase-session';

function imageTools() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-image-manipulator') as typeof import('expo-image-manipulator');
}

export async function choosePhoto(camera: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-image-picker') as typeof import('expo-image-picker');
  if (camera && !(await picker.requestCameraPermissionsAsync()).granted) {
    throw new Error('Allow camera access in Settings, or use From Photos.');
  }
  const options = { mediaTypes: picker.MediaTypeOptions.Images, quality: 0.9, exif: false };
  const result = camera
    ? await picker.launchCameraAsync(options)
    : await picker.launchImageLibraryAsync(options);
  if (result.canceled) return null;
  const asset = result.assets[0];
  const { manipulateAsync, SaveFormat } = imageTools();
  const resize =
    asset.width >= asset.height
      ? { width: Math.min(1600, asset.width) }
      : { height: Math.min(1600, asset.height) };
  return manipulateAsync(asset.uri, [{ resize }], { format: SaveFormat.JPEG, compress: 0.88 });
}

export async function suggestModel(photo: { uri: string; width: number; height: number }) {
  const client = getMobileSupabaseClient();
  const jwt = (await client?.auth.getSession())?.data.session?.access_token;
  if (!jwt || !publicEnv.API_PUBLIC_URL)
    throw new Error('Identification is unavailable. Enter the make and model.');
  const { manipulateAsync, SaveFormat } = imageTools();
  const resize =
    photo.width >= photo.height
      ? { width: Math.min(720, photo.width) }
      : { height: Math.min(720, photo.height) };
  const small = await manipulateAsync(photo.uri, [{ resize }], {
    format: SaveFormat.JPEG,
    compress: 0.65,
    base64: true,
  });
  if (!small.base64 || small.base64.length > 850000)
    throw new Error('Photo too large to scan. Enter the model.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(
      publicEnv.API_PUBLIC_URL.replace(/\/$/, '') + '/v1/spotted/identify',
      {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jpeg: small.base64 }),
      },
    );
    if (!response.ok) throw new Error('Identification is unavailable. Enter the make and model.');
    const result = await response.json();
    if (!result.suggestion?.make || !result.suggestion?.model)
      throw new Error('No clear match. Enter the make and model.');
    return result.suggestion as { make: string; model: string };
  } finally {
    clearTimeout(timeout);
  }
}
