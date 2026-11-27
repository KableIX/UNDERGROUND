import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { FinishWrite } from './routes/route-finishes';
import type { RunAttemptWrite } from './routes/run-attempts';
import type { RuntimeEnv } from './env';
import type { IntegrityStore } from './integrity/photo-proof';

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

/** Private run log writes (service role only). */
export interface RunLogGateway {
  recordRouteFinish(member: string, finish: FinishWrite): Promise<void>;
  /** Throws Error('finish_not_recorded') when credit arrives before the server-validated finish. */
  recordRunAttempt(member: string, write: RunAttemptWrite): Promise<void>;
}

export function createSupabaseMemberGateway(env: RuntimeEnv): (MemberGateway & RunLogGateway & IntegrityStore) | null {
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
    async recordRouteFinish(member: string, finish: FinishWrite) {
      const result = 'duration' in finish
        ? await admin.from('route_run_finishes').upsert({ member_id: member, attempt_id: finish.attempt, route_slug: finish.route, duration_ms: finish.duration }, { onConflict: 'member_id,attempt_id', ignoreDuplicates: true })
        : await admin.from('cruise_completions').upsert({member_id: member, route_slug: finish.route}, {onConflict: 'member_id,route_slug', ignoreDuplicates: true});
      if (result.error) throw new Error('result_save_unavailable');
    },

    async recordRunAttempt(member: string, write: RunAttemptWrite) {
      const a = write.analytics;
      const attempt = await admin.from('route_run_attempts').upsert({
        member_id: member,
        attempt_id: write.attempt,
        route_slug: write.route,
        outcome: write.outcome,
        abort_reason: write.abortReason,
        progress_m: write.progressM,
        progress_pct: write.progressPct,
        started_at: new Date(write.startedAtMs).toISOString(),
        ended_at: new Date(write.endedAtMs).toISOString(),
        finished_at: write.finishedAtMs === null ? null : new Date(write.finishedAtMs).toISOString(),
        vehicle_ref: write.vehicleId,
        start_label: write.startLabel,
        distance_m: a.distanceM,
        active_ms: Math.round(a.activeMs),
        moving_ms: Math.round(a.movingMs),
        stopped_ms: Math.round(a.stoppedMs),
        avg_speed_mps: a.avgSpeedMps,
        avg_moving_speed_mps: a.avgMovingSpeedMps,
        max_speed_mps: a.maxSpeedMps,
        elevation_gain_m: a.elevationGainM,
        elevation_loss_m: a.elevationLossM,
        min_altitude_m: a.minAltitudeM,
        max_altitude_m: a.maxAltitudeM,
        start_local_hour: a.startLocalHour,
        time_of_day: a.timeOfDay,
        gps_coverage_pct: a.gpsCoveragePct,
        good_fix_pct: a.goodFixPct,
        sample_count: a.sampleCount,
        signal_gap_count: a.signalGapCount,
      }, { onConflict: 'member_id,attempt_id', ignoreDuplicates: true });
      if (attempt.error) throw new Error('run_attempt_unavailable');
      if (!write.credit) return;
      const credit = write.credit;
      const car = credit.photos.find(photo => photo.kind === 'car') ?? null;
      const dash = credit.photos.find(photo => photo.kind === 'dash') ?? null;
      const result = await admin.from('route_run_credits').upsert({
        member_id: member,
        attempt_id: write.attempt,
        tier: credit.tier,
        points: credit.points,
        car_status: credit.car,
        dash_status: credit.dash,
        car_taken_at: car ? new Date(car.takenAtMs).toISOString() : null,
        dash_taken_at: dash ? new Date(dash.takenAtMs).toISOString() : null,
        car_image_sha256: car?.imageSha256 ?? null,
        dash_image_sha256: dash?.imageSha256 ?? null,
        attested: credit.attested,
        nonce_jti: credit.nonceJti,
        // First accepted credit is final; a retry never rewrites it.
      }, { onConflict: 'member_id,attempt_id', ignoreDuplicates: true });
      if (result.error?.code === '23503') throw new Error('finish_not_recorded');
      if (result.error?.code === '23505') throw new Error('photo_reused');
      if (result.error) throw new Error('run_credit_unavailable');
    },

    async saveDeviceKey(input) {
      const result = await admin.from('device_attest_keys').insert({
        key_id: input.keyId, member_id: input.member, platform: input.platform,
        public_key_pem: input.publicKeyPem, environment: input.environment, sign_count: 0,
      });
      if (result.error?.code === '23505') return 'exists';
      if (result.error) throw new Error('device_key_unavailable');
      return 'saved';
    },

    async loadDeviceKey(keyId) {
      const { data, error } = await admin.from('device_attest_keys')
        .select('member_id, public_key_pem, sign_count').eq('key_id', keyId).maybeSingle();
      if (error) throw new Error('device_key_unavailable');
      return data ? { member: data.member_id as string, publicKeyPem: data.public_key_pem as string, signCount: Number(data.sign_count) } : null;
    },

    async advanceDeviceCounter(keyId, from, to) {
      const { data, error } = await admin.from('device_attest_keys')
        .update({ sign_count: to, last_used_at: new Date().toISOString() })
        .eq('key_id', keyId).eq('sign_count', from).select('key_id');
      if (error) throw new Error('device_key_unavailable');
      return (data?.length ?? 0) === 1;
    },

    async consumeFinishNonce(input) {
      const inserted = await admin.from('run_finish_nonce_uses').insert({
        jti: input.jti, member_id: input.member, attempt_id: input.attempt, route_slug: input.route,
      });
      if (!inserted.error) return true;
      if (inserted.error.code !== '23505') throw new Error('finish_nonce_unavailable');
      // Already redeemed: only a retry of the same attempt by the same member is allowed.
      const { data } = await admin.from('run_finish_nonce_uses').select('member_id, attempt_id').eq('jti', input.jti).maybeSingle();
      return !!data && data.member_id === input.member && data.attempt_id === input.attempt;
    },

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
        return { member: memberResult.data, profile: profileResult.data, vehicles, mods: [], media: [] };
      }
      // Private originals are signed ONLY for the authenticated owner.
      // Friend/public galleries will require EXIF-stripped derivatives and separate authorization.
      const [modsResult, mediaResult] = await Promise.all([
        admin.from('vehicle_mods')
          .select('id,vehicle_id,title,status,installed_at')
          .in('vehicle_id', vehicleIds)
          .order('installed_at', { ascending: false, nullsFirst: false }),
        admin.from('vehicle_media')
          .select('id,vehicle_id,storage_path,caption,sort_order')
          .in('vehicle_id', vehicleIds)
          .eq('is_placeholder', false)
          .order('sort_order', { ascending: true })
          .limit(50),
      ]);
      if (modsResult.error) throw new Error('garage_mods_unavailable');
      const mods = modsResult.data ?? [];
      if (mediaResult.error) throw new Error('garage_media_unavailable');
      const media = mediaResult.data ?? [];
      if (!media.length) {
        return { member: memberResult.data, profile: profileResult.data, vehicles, mods, media: [] };
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
        mods,
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
