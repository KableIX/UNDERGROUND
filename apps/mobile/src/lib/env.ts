import { PublicEnvSchema, hasMapboxToken } from '@underground/domain';
import Constants from 'expo-constants';

function readPublicEnv() {
  return PublicEnvSchema.parse({
    APP_ENV: process.env.APP_ENV ?? 'development',
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '',
    API_PUBLIC_URL: process.env.API_PUBLIC_URL ?? '',
  });
}

export const publicEnv = readPublicEnv();

export const mapboxConfigured = hasMapboxToken(publicEnv);

export const appExtra = Constants.expoConfig?.extra ?? {};
