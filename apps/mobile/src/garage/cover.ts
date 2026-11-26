import Storage from 'expo-sqlite/kv-store';
import { publicEnv } from '../lib/env';
import { getMobileSupabaseClient, isLiveAuthConfigured } from '../session/supabase-session';

export type GaragePhoto = { id: string; readUrl: string | null };
export function coverKey(owner: string, car: string, live: boolean) {
  return 'garage-cover.v1.' + (live ? 'live' : 'local') + '.' + owner + '.' + car;
}
export function liveCover(photos: GaragePhoto[], preferred: string | null) {
  return photos.find(p => p.id === preferred)?.readUrl || photos.find(p => p.readUrl)?.readUrl || null;
}
export function localCover(file: string | null) {
  if (!file) return null;
  const fs = require('expo-file-system') as typeof import('expo-file-system');
  return fs.documentDirectory ? fs.documentDirectory + file : null;
}

// Read the signed-in owner's cover. Visitor pages use their published featured photo.
export async function ownerCover(owner: string, vehicle: string) {
  const live = isLiveAuthConfigured();
  const preferred = await Storage.getItem(coverKey(owner, vehicle, live));
  if (!live) return localCover(preferred);
  const client = getMobileSupabaseClient();
  const session = await client?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token || !publicEnv.API_PUBLIC_URL) throw Error('Sign in to view your garage photo.');
  const response = await fetch(publicEnv.API_PUBLIC_URL.replace(/\/$/, '') + '/v1/me', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!response.ok) throw Error('Could not load your garage photo.');
  const { profile } = await response.json() as { profile?: {
    member: { id: string }; media: (GaragePhoto & { vehicleId: string })[];
  } };
  if (profile?.member.id !== owner) throw Error('Could not open your garage.');
  return liveCover(profile.media.filter(photo => photo.vehicleId === vehicle), preferred);
}
