import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { RuntimeEnv } from './env';

const UuidSchema = z.string().uuid();

/** Only the backend may construct this gateway: its service key must never reach Expo. */
export interface MemberGateway {
  verifyUserJwt(jwt: string): Promise<string | null>;
  lookupMemberId(authUserId: string): Promise<string | null>;
  ownsVehicle(memberId: string, vehicleId: string): Promise<boolean>;
  createSignedGarageUpload(path: string): Promise<string>;
  garageObjectExists(path: string): Promise<boolean>;
  registerGarageMedia(input: { vehicleId: string; storagePath: string; caption: string | null; sortOrder: number }): Promise<string>;
  getOwnProfile(memberId: string): Promise<unknown>;
}

export function createSupabaseMemberGateway(env: RuntimeEnv): MemberGateway | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);

  return {
    async verifyUserJwt(jwt) {
      // getUser contacts Supabase Auth; a decoded-but-unverified JWT is NEVER trusted.
      const { data, error } = await authClient.auth.getUser(jwt);
      if (error || !data.user || !UuidSchema.safeParse(data.user.id).success) return null;
      return data.user.id;
    },

    async lookupMemberId(authUserId) {
      const { data, error } = await admin
        .from('members')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error) throw new Error('member_lookup_unavailable');
      return data && UuidSchema.safeParse(data.id).success ? data.id : null;
    },

    async ownsVehicle(memberId, vehicleId) {
      const { data, error } = await admin
        .from('vehicles')
        .select('id')
        .eq('id', vehicleId)
        .eq('owner_member_id', memberId)
        .maybeSingle();
      if (error) throw new Error('vehicle_lookup_unavailable');
      return Boolean(data);
    },

    async createSignedGarageUpload(path) {
      const { data, error } = await admin.storage
        .from('garage-originals')
        .createSignedUploadUrl(path, { upsert: false });
      if (error || !data?.signedUrl) throw new Error('garage_signing_unavailable');
      return data.signedUrl;
    },

    async garageObjectExists(path) {
      const { data, error } = await admin.storage.from('garage-originals').info(path);
      if (error || !data) return false;
      return true;
    },

    async registerGarageMedia(input) {
      const { data, error } = await admin
        .from('vehicle_media')
        .upsert({
          vehicle_id: input.vehicleId,
          storage_path: input.storagePath,
          caption: input.caption,
          sort_order: input.sortOrder,
          is_placeholder: false,
        }, { onConflict: 'storage_path' })
        .select('id')
        .single();
      if (error || !data?.id) throw new Error('garage_media_register_unavailable');
      return data.id;
    },

    async getOwnProfile(memberId) {
      const [memberResult, profileResult, vehiclesResult] = await Promise.all([
        admin.from('members')
          .select('id,member_number,display_name,is_founder,role')
          .eq('id', memberId).single(),
        admin.from('profiles')
          .select('member_id,bio,cover_asset_id,avatar_asset_id,friend_count,follower_count,top_eight')
          .eq('member_id', memberId).maybeSingle(),
        admin.from('vehicles')
          .select('id,year,make,model,trim,color,transmission,wheels,brakes,verification_status,visibility')
          .eq('owner_member_id', memberId),
      ]);
      if (memberResult.error || profileResult.error || vehiclesResult.error) {
        throw new Error('profile_lookup_unavailable');
      }
      const vehicles = vehiclesResult.data ?? [];
      const vehicleIds = vehicles.map((v) => v.id);
      if (!vehicleIds.length) {
        return { member: memberResult.data, profile: profileResult.data, vehicles, media: [] };
      }
      // Private originals are signed ONLY for the authenticated owner.
      // Friend/public galleries will require EXIF-stripped derivatives and separate authorization.
      const mediaResult = await admin.from('vehicle_media')
        .select('id,vehicle_id,storage_path,caption,sort_order')
        .in('vehicle_id', vehicleIds)
        .order('sort_order', { ascending: true })
        .limit(50);
      if (mediaResult.error) throw new Error('garage_media_unavailable');
      const media = mediaResult.data ?? [];
      if (!media.length) {
        return { member: memberResult.data, profile: profileResult.data, vehicles, media: [] };
      }
      const { data: signed, error: signingError } = await admin.storage
        .from('garage-originals')
        .createSignedUrls(media.map((m) => m.storage_path), 300);
      if (signingError) throw new Error('garage_media_signing_unavailable');
      const signedByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
      return {
        member: memberResult.data,
        profile: profileResult.data,
        vehicles,
        media: media.map((m) => ({
          id: m.id,
          vehicleId: m.vehicle_id,
          caption: m.caption,
          sortOrder: m.sort_order,
          readUrl: signedByPath.get(m.storage_path) ?? null,
        })),
      };
    },
  };
}

export type MemberSession = { memberId: string; authUserId: string };
export type MemberAuthResult =
  | { ok: true; session: MemberSession }
  | { ok: false; status: 401 | 403 | 503 | 502; error: string };

/** Explicit, injectable auth boundary: never accept a claimed member ID from the body. */
export async function authenticateMember(
  authorization: string | undefined,
  gateway: MemberGateway | null,
): Promise<MemberAuthResult> {
  if (!gateway) return { ok: false, status: 503, error: 'member_backend_not_configured' };
  const token = /^Bearer ([^\s]{10,4096})$/i.exec(authorization ?? '')?.[1];
  if (!token) return { ok: false, status: 401, error: 'missing_or_invalid_bearer' };
  try {
    const authUserId = await gateway.verifyUserJwt(token);
    if (!authUserId) return { ok: false, status: 401, error: 'invalid_access_token' };
    const memberId = await gateway.lookupMemberId(authUserId);
    if (!memberId) return { ok: false, status: 403, error: 'membership_not_active' };
    return { ok: true, session: { authUserId, memberId } };
  } catch {
    return { ok: false, status: 502, error: 'identity_service_unavailable' };
  }
}
