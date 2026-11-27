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
  return api<{ ok: boolean; tier: SupercargoTier; visibility: string; reason: string | null; publishAt: string | null; folio: boolean; atMeet?: boolean }>(
    '/v1/supercargo/sightings',
    { ...body, source: 'camera' },
  );
}

export function claimEnvelope(envelope: string, fix: { lat: number; lng: number; accuracyM: number; at: string }) {
  return api<{ ok: boolean; result: string }>('/v1/supercargo/envelopes/claim', { envelope, fix });
}

// ---- Live commissions, clubs, featured car ----

export type Commission = { commission_id: string; title: string; have: number; need: number; marked: boolean };
export type ClubMarks = { club_id: string; club_name: string; members: number; marks_this_week: number; marks_all_time: number };

export async function readCommissions() {
  const { data, error } = await db().rpc('supercargo_my_commissions');
  if (error) throw new Error('Commissions are unavailable.');
  return (data ?? []) as Commission[];
}

export async function readClubMarks() {
  const { data, error } = await db().rpc('supercargo_my_club_marks');
  if (error) return [];
  return (data ?? []) as ClubMarks[];
}

export async function readFeatured() {
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const { data } = await db()
    .from('supercargo_featured')
    .select('note, supercargo_catalog(make, model, tier)')
    .eq('week_start', monday.toISOString().slice(0, 10))
    .maybeSingle();
  const car = (data as unknown as { note: string | null; supercargo_catalog: { make: string; model: string; tier: SupercargoTier } | null } | null);
  return car?.supercargo_catalog ? { ...car.supercargo_catalog, note: car.note } : null;
}

// ---- The Exchange ----

export type TradeFolio = { id: string; owner: string; make: string; model: string; tier: SupercargoTier };
export type ExchangeRow = {
  id: string;
  incoming: boolean;
  other_number: string;
  status: 'open' | 'accepted' | 'declined' | 'withdrawn' | 'void';
  created_at: string;
  offered: Array<{ make: string; model: string; tier: SupercargoTier }>;
  requested: Array<{ make: string; model: string; tier: SupercargoTier }>;
};

export async function readExchanges() {
  const { data, error } = await db().rpc('supercargo_my_exchanges');
  if (error) throw new Error('The Exchange is unavailable.');
  return (data ?? []) as ExchangeRow[];
}

export async function readTradeable(memberNumber: string) {
  const { data, error } = await db().rpc('supercargo_tradeable_folios', { p_member_number: memberNumber });
  if (error) throw new Error('Could not read that collection.');
  return (data ?? []) as TradeFolio[];
}

export async function proposeExchange(counterparty: string, offered: string[], requested: string[]) {
  const { error } = await db().rpc('supercargo_propose_exchange', { p_counterparty: counterparty, p_offered: offered, p_requested: requested });
  if (error) throw new Error('Not sent. Folios must be envelope folios held for 24 hours, at most three a side.');
}

export async function decideExchange(id: string, accept: boolean) {
  const { data, error } = await db().rpc('supercargo_decide_exchange', { p_exchange: id, p_accept: accept });
  if (error) throw new Error('Could not record that. Try again.');
  return data as string;
}

// ---- Privacy: home zone and owner opt-out ----

export async function readHomeZone() {
  const { data } = await db().from('supercargo_home_zones').select('radius_m').maybeSingle();
  return data ? { radiusM: data.radius_m as number } : null;
}

export async function setHomeZone(lat: number, lng: number, radiusM = 400) {
  const { error } = await db()
    .from('supercargo_home_zones')
    .upsert({ zone: `SRID=4326;POINT(${lng} ${lat})`, radius_m: radiusM, updated_at: new Date().toISOString() });
  if (error) throw new Error('Could not save your home zone.');
}

export async function clearHomeZone() {
  const { error } = await db().from('supercargo_home_zones').delete().not('member_id', 'is', null);
  if (error) throw new Error('Could not clear your home zone.');
}

export type GarageCar = { id: string; year: number; make: string; model: string; optedOut: boolean };

export async function readGarageOptOuts(memberId: string): Promise<GarageCar[]> {
  const [cars, outs] = await Promise.all([
    db().from('vehicles').select('id, year, make, model').eq('owner_member_id', memberId),
    db().from('supercargo_optouts').select('vehicle_id'),
  ]);
  if (cars.error) throw new Error('Could not read your garage.');
  const off = new Set((outs.data ?? []).map((o) => o.vehicle_id as string));
  return (cars.data ?? []).map((c) => ({ id: c.id as string, year: c.year as number, make: c.make as string, model: c.model as string, optedOut: off.has(c.id as string) }));
}

export async function setOptOut(vehicleId: string, optedOut: boolean) {
  const q = optedOut
    ? db().from('supercargo_optouts').insert({ vehicle_id: vehicleId })
    : db().from('supercargo_optouts').delete().eq('vehicle_id', vehicleId);
  const { error } = await q;
  if (error) throw new Error('Could not save that.');
}
