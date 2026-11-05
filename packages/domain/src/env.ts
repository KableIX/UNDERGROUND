import { z } from 'zod';

export const AppEnvSchema = z.enum(['development', 'staging', 'production']);

export const PublicEnvSchema = z.object({
  APP_ENV: AppEnvSchema.default('development'),
  EXPO_PUBLIC_SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
  EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  API_PUBLIC_URL: z.string().url().optional().or(z.literal('')),
});

export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: AppEnvSchema.default('development'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional().or(z.literal('')),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),
  MAPBOX_ACCESS_TOKEN: z.string().optional().or(z.literal('')),
  SENTRY_DSN: z.string().optional().or(z.literal('')),
});

export type PublicEnv = z.infer<typeof PublicEnvSchema>;
export type ApiEnv = z.infer<typeof ApiEnvSchema>;

export function parseApiEnv(raw: NodeJS.ProcessEnv = process.env): ApiEnv {
  return ApiEnvSchema.parse(raw);
}

export function hasSupabaseCredentials(env: {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasMapboxToken(env: { EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?: string }): boolean {
  return Boolean(env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
}
