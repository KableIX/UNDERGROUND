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

// ---- Reports and moderation ----

export async function fileReport(sighting: string, reason: string, note: string) {
  const { error } = await db()
    .from('supercargo_reports')
    .insert({ sighting_id: sighting, reason, note: note.trim() ? note.trim().slice(0, 280) : null });
  if (error) throw new Error(error.code === '23505' ? 'You have already reported this sighting.' : 'Report not sent. Try again.');
}

export type ModerationNote = { sighting_id: string; make: string; model: string; status: string; reason: string; at: string };

export async function readMyModeration() {
  const { data } = await db().rpc('supercargo_my_moderation');
  return (data ?? []) as ModerationNote[];
}

export async function photoUrl(path: string | null) {
  if (!path) return null;
  const { data } = await db().storage.from('supercargo-redacted').createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

// ---- Admin ----

export async function readIsAdmin() {
  const { data } = await db().rpc('supercargo_is_admin');
  return data === true;
}

export type QueueItem = {
  sighting_id: string;
  make: string;
  model: string;
  tier: SupercargoTier;
  visibility: string;
  hold_reason: string | null;
  captured_on: string;
  photo_path: string | null;
  reports: Array<{ reason: string; count: number }> | null;
  notes: string[] | null;
};

export async function readQueue() {
  const { data, error } = await db().rpc('supercargo_admin_queue');
  if (error) throw new Error('The queue is unavailable.');
  return (data ?? []) as QueueItem[];
}

export async function decide(sighting: string, decision: 'restore' | 'remove' | 'correct_model', reason: string, catalogId?: string) {
  const { error } = await db().rpc('supercargo_admin_decide', {
    p_sighting: sighting,
    p_decision: decision,
    p_reason: reason,
    p_catalog: catalogId ?? null,
  });
  if (error) throw new Error('Not saved. Write a reason of at least three characters.');
}

export type AdminAnchor = {
  id: string;
  name: string;
  kind: string;
  lng: number;
  lat: number;
  active: boolean;
  open_envelopes: number;
  remaining: number;
};

export async function readAnchors() {
  const { data, error } = await db().rpc('supercargo_admin_anchors');
  if (error) throw new Error('Places are unavailable.');
  return (data ?? []) as AdminAnchor[];
}

export async function saveAnchor(a: { id: string; name: string; kind: string; lng: number; lat: number; active: boolean; publicPlace: boolean }) {
  const { error } = await db().rpc('supercargo_admin_save_anchor', {
    p_id: a.id,
    p_name: a.name,
    p_kind: a.kind,
    p_lng: a.lng,
    p_lat: a.lat,
    p_active: a.active,
    p_public_place: a.publicPlace,
  });
  if (error) throw new Error('Place not saved.');
}

export async function stockAnchor(anchor: string, hours: number, count: number, stock: number) {
  const { data, error } = await db().rpc('supercargo_admin_stock', { p_anchor: anchor, p_hours: hours, p_count: count, p_stock: stock });
  if (error) throw new Error('Not stocked. 1 to 72 hours, 1 to 50 envelopes, 1 to 50 each.');
  return data as number;
}

export type Meet = { id: string; anchor_id: string; name: string; starts_at: string; ends_at: string; radius_m: number };

export async function readMeets() {
  const { data, error } = await db()
    .from('supercargo_meets')
    .select('id, anchor_id, name, starts_at, ends_at, radius_m')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at');
  if (error) throw new Error('Meets are unavailable.');
  return (data ?? []) as Meet[];
}

export async function createMeet(m: { anchorId: string; name: string; startsAt: Date; hours: number; radiusM: number }) {
  const { error } = await db()
    .from('supercargo_meets')
    .insert({
      anchor_id: m.anchorId,
      name: m.name,
      starts_at: m.startsAt.toISOString(),
      ends_at: new Date(m.startsAt.getTime() + m.hours * 3_600_000).toISOString(),
      radius_m: m.radiusM,
    });
  if (error) throw new Error('Meet not saved. It needs a curated-meet place, at most 12 hours, 50 to 400 m.');
}

export async function deleteMeet(id: string) {
  const { error } = await db().from('supercargo_meets').delete().eq('id', id);
  if (error) throw new Error('Could not remove that meet.');
}

export type CatalogCar = { id: string; make: string; model: string; tier: SupercargoTier };

export async function readCatalog() {
  const { data, error } = await db().from('supercargo_catalog').select('id, make, model, tier').order('make');
  if (error) throw new Error('The catalog is unavailable.');
  return (data ?? []) as CatalogCar[];
}

export async function readFeaturedWeeks(weeks: string[]) {
  const { data } = await db().from('supercargo_featured').select('week_start, catalog_id, note').in('week_start', weeks);
  return (data ?? []) as Array<{ week_start: string; catalog_id: string; note: string | null }>;
}

export async function setFeatured(week: string, catalogId: string, note: string) {
  const { error } = await db()
    .from('supercargo_featured')
    .upsert({ week_start: week, catalog_id: catalogId, note: note.trim() || null }, { onConflict: 'week_start' });
  if (error) throw new Error('Featured car not saved.');
}
