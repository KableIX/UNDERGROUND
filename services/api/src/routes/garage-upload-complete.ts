import { z } from 'zod';
import type { MemberGateway, MemberSession } from '../supabase-gateway';

const FinalizeSchema = z.object({
  memberId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  caption: z.string().max(280).nullable(),
  sortOrder: z.number().int().nonnegative(),
});

export type FinalizeResult =
  | { ok: true; mediaId: string; storagePath: string; vehicleId: string }
  | { ok: false; status: 400 | 403 | 404 | 502; error: string };

/** Persists private media metadata only after the signed upload actually exists. */
export async function finalizeGarageUpload(input: {
  raw: unknown;
  session: MemberSession;
  gateway: Pick<MemberGateway, 'ownsVehicle' | 'garageObjectExists' | 'registerGarageMedia'>;
}): Promise<FinalizeResult> {
  const parsed = FinalizeSchema.safeParse(input.raw);
  if (!parsed.success) return { ok: false, status: 400, error: 'invalid_media_completion' };
  const body = parsed.data;

  if (body.memberId !== input.session.memberId) {
    return { ok: false, status: 403, error: 'member_identity_mismatch' };
  }
  const prefix = `garage/${input.session.authUserId}/${body.vehicleId}/`;
  const filename = body.storagePath.slice(prefix.length);
  const matches = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(filename);
  if (!body.storagePath.startsWith(prefix) || !matches) {
    return { ok: false, status: 403, error: 'invalid_media_namespace' };
  }
  try {
    if (!await input.gateway.ownsVehicle(input.session.memberId, body.vehicleId)) {
      return { ok: false, status: 403, error: 'vehicle_not_owned' };
    }
    if (!await input.gateway.garageObjectExists(body.storagePath)) {
      return { ok: false, status: 404, error: 'uploaded_object_not_found' };
    }
    const mediaId = await input.gateway.registerGarageMedia({
      vehicleId: body.vehicleId,
      storagePath: body.storagePath,
      caption: body.caption,
      sortOrder: body.sortOrder,
    });
    return { ok: true, mediaId, vehicleId: body.vehicleId, storagePath: body.storagePath };
  } catch {
    return { ok: false, status: 502, error: 'garage_metadata_unavailable' };
  }
}
