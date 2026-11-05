import {
  GarageMediaUploadIntentSchema,
  planGarageMediaUpload,
  type GarageMediaUploadPlan,
} from '@underground/domain';
import type { RuntimeEnv } from '../env';

export type GarageMediaUploadResponse =
  | { ok: true; plan: GarageMediaUploadPlan }
  | { ok: false; error: string };

/**
 * Private garage original upload planner.
 * Without Supabase credentials returns placeholder paths — never invents signed URLs.
 */
export function handleGarageMediaUploadIntent(input: {
  env: RuntimeEnv;
  raw: unknown;
}): GarageMediaUploadResponse {
  const parsed = GarageMediaUploadIntentSchema.safeParse(input.raw);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_upload_intent' };
  }

  const plan = planGarageMediaUpload({
    intent: parsed.data,
    supabaseReady: input.env.supabaseReady,
    // Signed URL minting waits on live Supabase — intentionally omitted.
  });

  return { ok: true, plan };
}
