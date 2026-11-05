import { z } from 'zod';

/** Private buckets — originals never public without an explicit sanitized derivative. */
export const PrivateStorageBucketSchema = z.enum([
  'garage-originals',
  'evidence-originals',
]);

export type PrivateStorageBucket = z.infer<typeof PrivateStorageBucketSchema>;

export const GarageMediaUploadIntentSchema = z.object({
  vehicleId: z.string().uuid(),
  memberId: z.string().uuid(),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  caption: z.string().max(280).nullable(),
  sortOrder: z.number().int().nonnegative(),
  /** Client-local URI or file name hint — never a remote secret. */
  localUri: z.string().min(1),
});

export type GarageMediaUploadIntent = z.infer<typeof GarageMediaUploadIntentSchema>;

export const GarageMediaUploadPlanSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('placeholder'),
    bucket: PrivateStorageBucketSchema,
    storagePath: z.string().min(1),
    isPlaceholder: z.literal(true),
    reason: z.literal('supabase_credentials_absent'),
    uploadUrl: z.null(),
  }),
  z.object({
    mode: z.literal('signed_upload'),
    bucket: PrivateStorageBucketSchema,
    storagePath: z.string().min(1),
    isPlaceholder: z.literal(false),
    /** Short-lived signed URL — never log or commit. */
    uploadUrl: z.string().url(),
    expiresAt: z.string().datetime(),
  }),
]);

export type GarageMediaUploadPlan = z.infer<typeof GarageMediaUploadPlanSchema>;

export function buildGarageStoragePath(input: {
  memberId: string;
  vehicleId: string;
  fileName: string;
}): string {
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `garage/${input.memberId}/${input.vehicleId}/${safe}`;
}

/**
 * Plan a private garage original upload.
 * Without Supabase credentials, returns a clearly marked placeholder path.
 */
export function planGarageMediaUpload(input: {
  intent: GarageMediaUploadIntent;
  supabaseReady: boolean;
  /** Injected only when credentials exist — callers must not print. */
  signedUploadUrl?: string;
  expiresAt?: string;
}): GarageMediaUploadPlan {
  const fileHint = input.intent.localUri.split('/').pop() ?? 'upload.jpg';
  const storagePath = buildGarageStoragePath({
    memberId: input.intent.memberId,
    vehicleId: input.intent.vehicleId,
    fileName: fileHint.includes('PLACEHOLDER')
      ? fileHint
      : `${Date.now()}-${fileHint}`,
  });

  if (!input.supabaseReady || !input.signedUploadUrl || !input.expiresAt) {
    return GarageMediaUploadPlanSchema.parse({
      mode: 'placeholder',
      bucket: 'garage-originals',
      storagePath: storagePath.includes('PLACEHOLDER')
        ? storagePath
        : `placeholders/${storagePath}.PLACEHOLDER.jpg`,
      isPlaceholder: true,
      reason: 'supabase_credentials_absent',
      uploadUrl: null,
    });
  }

  return GarageMediaUploadPlanSchema.parse({
    mode: 'signed_upload',
    bucket: 'garage-originals',
    storagePath,
    isPlaceholder: false,
    uploadUrl: input.signedUploadUrl,
    expiresAt: input.expiresAt,
  });
}
