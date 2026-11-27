import type { SupercargoTier } from '@underground/domain';
import { publicEnv } from '../lib/env';
import { getMobileSupabaseClient } from '../session/supabase-session';

export type MapSighting = {
  id: string;
  cell_id: string;
  cell_lat: number;
  cell_lng: number;
  make: string;
  model: string;
  tier: SupercargoTier;
  photo_path: string | null;
  seen_on: string;
  spotter_number: string | null;
};

export type Folio = {
  id: string;
  catalog_id: string;
  origin: 'sighting' | 'envelope';
  acquired_at: string;
  supercargo_catalog: { make: string; model: string; tier: SupercargoTier } | null;
};

export type SealedEnvelope = { id: string; anchor_name: string; anchor_kind: string; lng: number; lat: number; closes_at: string };

function db() {
  const client = getMobileSupabaseClient();
  if (!client) throw new Error('SupercarGO needs a member session.');
  return client;
}

async function api<T>(path: string, body: unknown): Promise<T> {
  const jwt = (await db().auth.getSession()).data.session?.access_token;
  if (!jwt || !publicEnv.API_PUBLIC_URL) throw new Error('SupercarGO is unavailable right now.');
  const response = await fetch(publicEnv.API_PUBLIC_URL.replace(/\/$/, '') + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as T & { message?: string; error?: string };
  if (!response.ok && response.status !== 409) throw new Error(json.message ?? 'Not logged. Try again.');
  return json;
}

export async function readSettings() {
  const { data } = await db().from('supercargo_settings').select('enabled, credit_public').maybeSingle();
  return { enabled: !!data?.enabled, creditPublic: !!data?.credit_public };
}

export async function saveSettings(enabled: boolean, creditPublic: boolean) {
  const { error } = await db().from('supercargo_settings').upsert({ enabled, credit_public: creditPublic, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save. Try again.');
}

export async function readMap(bounds: { west: number; south: number; east: number; north: number }) {
  const { data, error } = await db().rpc('supercargo_map', { p_west: bounds.west, p_south: bounds.south, p_east: bounds.east, p_north: bounds.north });
  if (error) throw new Error('The map is unavailable.');
  return (data ?? []) as MapSighting[];
}

export async function readLedger() {
  const { data, error } = await db()
    .from('supercargo_ledger')
    .select('id, catalog_id, origin, acquired_at, supercargo_catalog(make, model, tier)')
    .order('acquired_at', { ascending: false });
  if (error) throw new Error('The Ledger is unavailable.');
  return (data ?? []) as unknown as Folio[];
}

export async function readEnvelopes(lng: number, lat: number) {
  const { data, error } = await db().rpc('supercargo_envelopes_near', { p_lng: lng, p_lat: lat });
  if (error) return [];
  return (data ?? []) as SealedEnvelope[];
}

export async function reportSighting(sighting: string, reason: string) {
  const { error } = await db().from('supercargo_reports').insert({ sighting_id: sighting, reason });
  if (error) throw new Error('Report not sent. Try again.');
}

export function captureNonce() {
  return api<{ nonce: string }>('/v1/supercargo/capture-nonce', {});
}

export function submitSighting(body: {
  nonce: string;
  jpeg: string;
  capturedAt: string;
  fix: { lat: number; lng: number; accuracyM: number; at: string };
  make: string;
  model: string;
}) {
  return api<{ ok: boolean; tier: SupercargoTier; visibility: string; reason: string | null; publishAt: string | null; folio: boolean }>(
    '/v1/supercargo/sightings',
    { ...body, source: 'camera' },
  );
}

export function claimEnvelope(envelope: string, fix: { lat: number; lng: number; accuracyM: number; at: string }) {
  return api<{ ok: boolean; result: string }>('/v1/supercargo/envelopes/claim', { envelope, fix });
}
