import { decode } from 'base64-arraybuffer';
import type { FinishPhotoKind } from '@underground/domain';
import { getMobileSupabaseClient } from '../session/supabase-session';

/**
 * Upload one location-stripped finish photo to the private evidence bucket through a
 * server-signed URL. The server picks the path (runs/<member>/<attempt>/<kind>.jpg).
 * Returns the storage path, or null to retry on the next sync.
 */
export async function uploadRunPhoto(input: { base: string; token: string; attempt: string; kind: FinishPhotoKind; uri: string }): Promise<string | null> {
  try {
    const supabase = getMobileSupabaseClient();
    if (!supabase) return null;
    const response = await fetch(input.base + '/v1/run-photos/upload-intent', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + input.token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ attempt: input.attempt, kind: input.kind, contentType: 'image/jpeg' }),
    });
    if (!response.ok) return null;
    const plan = (await response.json()) as { ok?: boolean; bucket?: string; storagePath?: string; uploadUrl?: string };
    if (!plan.ok || plan.bucket !== 'evidence-originals' || !plan.storagePath || !plan.uploadUrl) return null;
    const signed = new URL(plan.uploadUrl).searchParams.get('token');
    if (!signed) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('expo-file-system') as typeof import('expo-file-system');
    const base64 = await fs.readAsStringAsync(input.uri, { encoding: fs.EncodingType.Base64 });
    if (base64.length > 28_000_000) return null;
    const { error } = await supabase.storage
      .from('evidence-originals')
      .uploadToSignedUrl(plan.storagePath, signed, decode(base64), { contentType: 'image/jpeg', upsert: true });
    return error ? null : plan.storagePath;
  } catch {
    return null;
  }
}
