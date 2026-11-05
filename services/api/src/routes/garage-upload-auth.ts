import { randomUUID } from 'node:crypto';
import {
  GarageMediaUploadIntentSchema,
  GarageMediaUploadPlanSchema,
  type GarageMediaUploadPlan,
} from '@underground/domain';
import type { MemberGateway, MemberSession } from '../supabase-gateway';

type UploadResult =
  | { ok: true; plan: GarageMediaUploadPlan }
  | { ok: false; status: 400 | 403 | 502; error: string };

const extension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Authorize the identity and vehicle independently of any request-supplied IDs.
 * This creates an ephemeral, scoped upload capability, not a public media URL.
 * Clients must upload bytes using the resulting signed URL. Metadata persistence
 * is a separate finalize operation and is NOT performed here.
 */
export async function issueAuthorizedGarageUpload(input: {
  raw: unknown;
  session: MemberSession;
  gateway: Pick<MemberGateway, 'ownsVehicle' | 'createSignedGarageUpload'>;
  now?: Date;
  makeId?: () => string;
}): Promise<UploadResult> {
  const parsed = GarageMediaUploadIntentSchema.safeParse(input.raw);
  if (!parsed.success) return { ok: false, status: 400, error: 'invalid_upload_intent' };
  const intent = parsed.data;

  if (intent.memberId !== input.session.memberId) {
    return { ok: false, status: 403, error: 'member_identity_mismatch' };
  }
  try {
    const owner = await input.gateway.ownsVehicle(input.session.memberId, intent.vehicleId);
    if (!owner) return { ok: false, status: 403, error: 'vehicle_not_owned' };

    // Match garage-originals RLS path policy: garage/<auth.uid()>/<vehicle UUID>/...
    const fileName = (input.makeId ?? randomUUID)();
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileName);
    if (!validId) throw new Error('invalid_file_id');
    const storagePath =
      `garage/${input.session.authUserId}/${intent.vehicleId}/${fileName}.${extension[intent.contentType]}`;
    const signedUrl = await input.gateway.createSignedGarageUpload(storagePath);
    const expiresAt = new Date((input.now ?? new Date()).getTime() + 2 * 60 * 60 * 1000).toISOString();
    return {
      ok: true,
      plan: GarageMediaUploadPlanSchema.parse({
        mode: 'signed_upload',
        bucket: 'garage-originals',
        storagePath,
        isPlaceholder: false,
        uploadUrl: signedUrl,
        expiresAt,
      }),
    };
  } catch {
    return { ok: false, status: 502, error: 'upload_signing_unavailable' };
  }
}
