import { createClient } from '@supabase/supabase-js';
import { findSupercargoEntry, supercargoSeedCatalog, type SupercargoTier } from '@underground/domain';
import type { RuntimeEnv } from './env';
import type { SightingRecord, SupercargoStore } from './routes/supercargo';

/**
 * Supabase-backed SupercarGO store, service role. Not exercised against a live
 * project yet: the migration has only been applied to a throwaway database.
 */
export function createSupabaseSupercargoStore(env: RuntimeEnv): SupercargoStore | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const point = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;

  return {
    async lastCreditedFix(member) {
      const { data, error } = await admin
        .from('supercargo_sightings')
        .select('captured_at, cell_lat, cell_lng')
        .eq('spotter', member)
        .eq('credited', true)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error('supercargo_unavailable');
      // Cell centers are within ~1.6 km of the true point; the teleport check allows for that.
      return data ? { lat: data.cell_lat, lng: data.cell_lng, at: new Date(data.captured_at) } : null;
    },
    async creditedSince(member, since) {
      const { count, error } = await admin
        .from('supercargo_sightings')
        .select('id', { count: 'exact', head: true })
        .eq('spotter', member)
        .eq('credited', true)
        .gte('captured_at', since.toISOString());
      if (error) throw new Error('supercargo_unavailable');
      return count ?? 0;
    },
    async imageSeen() {
      // Exact-duplicate hashes are not persisted yet; see ADR open items (perceptual hash).
      return false;
    },
    async findCatalog(make, model) {
      const seed = findSupercargoEntry(make, model, supercargoSeedCatalog);
      if (!seed) return null;
      const { data, error } = await admin.from('supercargo_catalog').select('id, tier').eq('id', seed.id).maybeSingle();
      if (error) throw new Error('supercargo_unavailable');
      return data ? { id: data.id as string, tier: data.tier as SupercargoTier } : null;
    },
    async privacyFlags(member, make, model, lat, lng) {
      const { data, error } = await admin.rpc('supercargo_privacy_flags', {
        p_member: member,
        p_make: make,
        p_model: model,
        p_lng: lng,
        p_lat: lat,
      });
      if (error || !Array.isArray(data) || !data[0]) throw new Error('supercargo_unavailable');
      const row = data[0] as { near_home: boolean; own_car: boolean; opted_out: boolean };
      return { nearHome: row.near_home, ownCar: row.own_car, optedOut: row.opted_out };
    },
    async saveSighting(r: SightingRecord) {
      let photoPath: string | null = null;
      const id = crypto.randomUUID();
      if (r.redactedJpeg) {
        photoPath = `supercargo/redacted/${r.capturedAt.toISOString().slice(0, 7)}/${id}.jpg`;
        const upload = await admin.storage
          .from('supercargo-redacted')
          .upload(photoPath, Buffer.from(r.redactedJpeg, 'base64'), { contentType: 'image/jpeg', upsert: false });
        if (upload.error) photoPath = null;
      }
      const visibility = r.visibility === 'public' && !photoPath ? 'private' : r.visibility;
      const insert = await admin.from('supercargo_sightings').insert({
        id,
        spotter: r.spotter,
        catalog_id: r.catalogId,
        make: r.make,
        model: r.model,
        tier: r.tier,
        source: 'camera',
        credited: r.credited,
        visibility,
        hold_reason: visibility === r.visibility ? r.holdReason : 'upload_failed',
        redaction: r.redaction,
        captured_at: r.capturedAt.toISOString(),
        publish_at: r.publishAt.toISOString(),
        expires_at: r.expiresAt.toISOString(),
        cell_id: r.cell.id,
        cell_lat: r.cell.lat,
        cell_lng: r.cell.lng,
        photo_path: photoPath,
      });
      if (insert.error) throw new Error('supercargo_unavailable');
      const extra = await Promise.all([
        admin.from('supercargo_sighting_points').insert({ sighting_id: id, point: point(r.point.lat, r.point.lng), accuracy_m: r.point.accuracyM }),
        r.credited && r.catalogId
          ? admin.from('supercargo_ledger').insert({ member_id: r.spotter, catalog_id: r.catalogId, origin: 'sighting', sighting_id: id })
          : Promise.resolve({ error: null }),
      ]);
      if (extra.some((x) => x.error)) {
        await admin.from('supercargo_sightings').delete().eq('id', id);
        throw new Error('supercargo_unavailable');
      }
      return id;
    },
    async claimEnvelope(member, envelope, fix) {
      const { data, error } = await admin.rpc('supercargo_claim_envelope', {
        p_member: member,
        p_envelope: envelope,
        p_lng: fix.lng,
        p_lat: fix.lat,
        p_accuracy_m: fix.accuracyM,
      });
      if (error || typeof data !== 'string') throw new Error('supercargo_unavailable');
      return data;
    },
  };
}
