import { decode } from 'base64-arraybuffer';
import type { GarageMediaUploadPlan } from '@underground/domain';
import { publicEnv } from '../lib/env';
import { getMobileSupabaseClient } from '../session/supabase-session';

type UploadIntent = {
  vehicleId: string;
  memberId: string;
  localUri: string;
  caption: string;
  sortOrder: number;
};

type UploadResult = { ok: true; plan: GarageMediaUploadPlan } |
  { ok: false; error: string };

async function memberApi(path: string, jwt: string, body: object): Promise<Response> {
  return fetch(`${publicEnv.API_PUBLIC_URL!.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Uploads a JPEG into a private bucket using a server-authorized, short-lived
 * signed URL. Never accepts a caller-selected storage namespace.
 * No public read URL or unverified media record is published.
 */
export async function uploadPrivateGarageJpeg(input: UploadIntent): Promise<UploadResult> {
  const supabase = getMobileSupabaseClient();
  if (!supabase || !publicEnv.API_PUBLIC_URL) {
    return { ok: false, error: 'secure_garage_backend_not_configured' };
  }
  const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
  const jwt = sessionResult.session?.access_token;
  if (sessionError || !jwt) return { ok: false, error: 'member_login_required' };
  try {
    const requested = await memberApi('/v1/garage/media/upload-intent', jwt, {
      ...input,
      contentType: 'image/jpeg',
    });
    if (!requested.ok) {
      return { ok: false, error: requested.status === 403 ? 'garage_access_denied' : 'upload_authorization_failed' };
    }
    const authorization = await requested.json() as {
      ok: boolean; plan?: GarageMediaUploadPlan;
    };
    const plan = authorization.plan;
    if (!authorization.ok || !plan || plan.mode !== 'signed_upload' ||
      plan.bucket !== 'garage-originals' || !plan.uploadUrl) {
      return { ok: false, error: 'invalid_signed_upload_plan' };
    }

    const token = new URL(plan.uploadUrl).searchParams.get('token');
    if (!token) return { ok: false, error: 'signed_upload_token_missing' };

    // Import lazily: previous signed dev clients may not have the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as typeof import('expo-file-system');
    const base64 = await fs.readAsStringAsync(input.localUri, {
      encoding: fs.EncodingType.Base64,
    });
    // The private bucket has a 20 MB maximum. Limit decoded memory before transferring.
    if (base64.length > 28_000_000) {
      return { ok: false, error: 'image_exceeds_20mb_limit' };
    }
    const bytes = decode(base64);
    if (bytes.byteLength > 20 * 1024 * 1024) {
      return { ok: false, error: 'image_exceeds_20mb_limit' };
    }
    const { error: uploadError } = await supabase.storage
      .from('garage-originals')
      .uploadToSignedUrl(plan.storagePath, token, bytes, {
        contentType: 'image/jpeg',
        upsert: false,
      });
    if (uploadError) return { ok: false, error: 'photo_transfer_failed' };

    const committed = await memberApi('/v1/garage/media/complete', jwt, {
      vehicleId: input.vehicleId,
      memberId: input.memberId,
      storagePath: plan.storagePath,
      caption: input.caption,
      sortOrder: input.sortOrder,
    });
    if (!committed.ok) {
      return { ok: false, error: 'photo_uploaded_but_registration_failed' };
    }
    const body = await committed.json() as { ok: boolean };
    if (!body.ok) return { ok: false, error: 'photo_registration_failed' };
    return { ok: true, plan };
  } catch {
    return { ok: false, error: 'garage_upload_unavailable' };
  }
}
