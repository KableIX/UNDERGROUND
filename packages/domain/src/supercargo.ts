/**
 * SupercarGO: optional car spotting for members.
 *
 * Pure rules shared by the API, the mobile app and the tests. Nothing here
 * touches the network, the camera or the database. See
 * docs/decisions/ADR-car-spotting.md for the reasoning behind each number.
 */

export const SUPERCARGO_NAME = 'SupercarGO';

// ---------------------------------------------------------------------------
// Rarity. Tier is a fact taken from production numbers. Score orders cars
// inside a tier and never moves a car across a tier boundary.
// ---------------------------------------------------------------------------

export const SupercargoTiers = ['open', 'limited', 'numbered', 'allocated', 'atelier', 'singular'] as const;
export type SupercargoTier = (typeof SupercargoTiers)[number];

export const SupercargoTierLabels: Record<SupercargoTier, string> = {
  open: 'Open',
  limited: 'Limited',
  numbered: 'Numbered',
  allocated: 'Allocated',
  atelier: 'Atelier',
  singular: 'Singular',
};

/** One-line meaning shown under each tier name. */
export const SupercargoTierNotes: Record<SupercargoTier, string> = {
  open: 'Series production, or production not yet sourced.',
  limited: 'Fewer than 15,000 built.',
  numbered: 'Fewer than 2,000 built.',
  allocated: 'Fewer than 500 built.',
  atelier: 'Fewer than 100 built.',
  singular: 'Ten or fewer.',
};

/** Upper bound of effective production for each tier (inclusive). */
const tierCeilings: Array<[SupercargoTier, number]> = [
  ['singular', 10],
  ['atelier', 100],
  ['allocated', 500],
  ['numbered', 2000],
  ['limited', 15000],
];

/** Score band for each tier, so ordering never contradicts the tier. */
export const SupercargoScoreBands: Record<SupercargoTier, [number, number]> = {
  open: [0, 16],
  limited: [17, 33],
  numbered: [34, 45],
  allocated: [46, 59],
  atelier: [60, 79],
  singular: [80, 100],
};

export interface SupercargoRarityInput {
  /** Units built, from a cited public source. Null when unsourced. */
  built: number | null;
  /** First model year. Older cars are scarcer than their build count. */
  firstYear: number | null;
  /** Year the rarity is computed for. */
  asOfYear: number;
  /** Credited member sightings of this catalog entry in the last 90 days. */
  memberSightings90d?: number;
  /** Members' garages holding this catalog entry. */
  garageCount?: number;
}

export interface SupercargoRarity {
  tier: SupercargoTier;
  score: number;
  effective: number | null;
  provisional: boolean;
}

/** Share of a model still on the road, by age. Coarse on purpose. */
export function survivalFactor(firstYear: number | null, asOfYear: number): number {
  if (firstYear === null) return 1;
  const age = asOfYear - firstYear;
  if (age < 15) return 1;
  if (age < 30) return 0.8;
  if (age < 50) return 0.6;
  return 0.4;
}

export function tierForEffective(effective: number | null): SupercargoTier {
  if (effective === null) return 'open';
  for (const [tier, ceiling] of tierCeilings) if (effective <= ceiling) return tier;
  return 'open';
}

export function computeRarity(input: SupercargoRarityInput): SupercargoRarity {
  if (input.built === null || !Number.isFinite(input.built) || input.built < 1) {
    return { tier: 'open', score: 0, effective: null, provisional: true };
  }
  const effective = Math.max(1, Math.ceil(input.built * survivalFactor(input.firstYear, input.asOfYear)));
  const tier = tierForEffective(effective);
  const base = 100 - 20 * Math.log10(effective);
  // Seen often among members reads a little less rare; owned by members, a little less again.
  const seen = Math.min(8, 4 * Math.log10(1 + Math.max(0, input.memberSightings90d ?? 0)));
  const owned = Math.min(4, Math.max(0, input.garageCount ?? 0));
  const [low, high] = SupercargoScoreBands[tier];
  const score = Math.min(high, Math.max(low, Math.round(base - seen - owned)));
  return { tier, score, effective, provisional: false };
}

export interface SupercargoCatalogEntry {
  id: string;
  make: string;
  model: string;
  variant?: string;
  built: number | null;
  builtSource: string | null;
  firstYear: number | null;
}

/** A tier above Open needs a production number with a source. */
export function catalogEntryProblems(entry: SupercargoCatalogEntry): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9-]{2,80}$/.test(entry.id)) problems.push('id');
  if (!entry.make.trim() || !entry.model.trim()) problems.push('name');
  if (entry.built !== null && !entry.builtSource?.trim()) problems.push('built_source');
  if (entry.built !== null && (!Number.isInteger(entry.built) || entry.built < 1)) problems.push('built');
  return problems;
}

// ---------------------------------------------------------------------------
// Theft safety. The map shows where a car was, at neighborhood scale, after it
// has most likely left.
// ---------------------------------------------------------------------------

export const SUPERCARGO_VISIBLE_HOURS = 72;

/** Hours a sighting is held before anyone else can see it. */
export const SupercargoHoldHours: Record<SupercargoTier, number> = {
  open: 6,
  limited: 6,
  numbered: 12,
  allocated: 12,
  atelier: 24,
  singular: 24,
};

/** Cell size in degrees of latitude: about 2.2 km, or about 11 km for the rarest. */
export function cellStepDegrees(tier: SupercargoTier): number {
  return tier === 'atelier' || tier === 'singular' ? 0.1 : 0.02;
}

export interface SupercargoCell {
  id: string;
  lat: number;
  lng: number;
  stepDeg: number;
}

/** Snap a point to the center of its grid cell. The precise point never leaves the server. */
export function fuzzToCell(lat: number, lng: number, tier: SupercargoTier): SupercargoCell {
  const step = cellStepDegrees(tier);
  const row = Math.floor(lat / step);
  const cellLat = (row + 0.5) * step;
  const lngStep = step / Math.max(0.2, Math.cos((cellLat * Math.PI) / 180));
  const col = Math.floor(lng / lngStep);
  const cellLng = (col + 0.5) * lngStep;
  return {
    id: `c${step}:${row}:${col}`,
    lat: Math.round(cellLat * 10000) / 10000,
    lng: Math.round(cellLng * 10000) / 10000,
    stepDeg: step,
  };
}

export function publicWindow(capturedAt: Date, tier: SupercargoTier) {
  const at = capturedAt.getTime();
  return {
    publishAt: new Date(at + SupercargoHoldHours[tier] * 3600_000),
    expiresAt: new Date(at + SUPERCARGO_VISIBLE_HOURS * 3600_000),
  };
}

export type SupercargoRedaction = 'pending' | 'done' | 'failed';

export interface PublicationFacts {
  source: 'camera' | 'library';
  redaction: SupercargoRedaction;
  /** Inside any member's private home zone. */
  nearHomeZone: boolean;
  /** The car matches a vehicle whose owner opted out. */
  ownerOptedOut: boolean;
  /** The car matches a vehicle in the spotter's own garage. */
  spottersOwnCar: boolean;
  /** Capture checks passed (see verifyCapture). */
  captureVerified: boolean;
}

export type PublicationDecision =
  | { visibility: 'public'; credited: true }
  | { visibility: 'held'; credited: boolean; reason: 'redaction_pending' }
  | { visibility: 'private'; credited: boolean; reason: PrivateReason };

type PrivateReason = 'library_photo' | 'unverified_capture' | 'home_zone' | 'owner_opt_out' | 'own_car' | 'redaction_failed';

/**
 * What the map may know about one sighting. Every doubt resolves to private.
 * Credit (a folio in the Ledger) only needs a verified fresh capture of
 * someone else's car; publication needs far more.
 */
export function decidePublication(f: PublicationFacts): PublicationDecision {
  if (f.source === 'library') return { visibility: 'private', credited: false, reason: 'library_photo' };
  if (!f.captureVerified) return { visibility: 'private', credited: false, reason: 'unverified_capture' };
  if (f.spottersOwnCar) return { visibility: 'private', credited: false, reason: 'own_car' };
  if (f.ownerOptedOut) return { visibility: 'private', credited: true, reason: 'owner_opt_out' };
  if (f.nearHomeZone) return { visibility: 'private', credited: true, reason: 'home_zone' };
  if (f.redaction === 'failed') return { visibility: 'private', credited: true, reason: 'redaction_failed' };
  if (f.redaction === 'pending') return { visibility: 'held', credited: true, reason: 'redaction_pending' };
  return { visibility: 'public', credited: true };
}

// ---------------------------------------------------------------------------
// Anti-cheat. Credit needs a fresh in-app camera capture with a GPS fix.
// ---------------------------------------------------------------------------

export const SupercargoCaptureLimits = {
  nonceMaxAgeMs: 5 * 60_000,
  submitMaxDelayMs: 30 * 60_000,
  fixMaxSkewMs: 2 * 60_000,
  fixMaxAccuracyM: 100,
  maxImpliedKph: 300,
  creditedPerDay: 30,
} as const;

export interface GeoFix {
  lat: number;
  lng: number;
  accuracyM: number;
  at: Date;
}

export interface CaptureFacts {
  source: 'camera' | 'library';
  nonceIssuedAt: Date | null;
  capturedAt: Date;
  submittedAt: Date;
  fix: GeoFix | null;
  previous?: { lat: number; lng: number; at: Date } | null;
  creditedToday: number;
  duplicateImage: boolean;
}

export type CaptureProblem =
  | 'library_photo'
  | 'no_nonce'
  | 'stale_nonce'
  | 'late_submit'
  | 'clock'
  | 'no_fix'
  | 'weak_fix'
  | 'stale_fix'
  | 'teleport'
  | 'daily_limit'
  | 'duplicate';

export function verifyCapture(f: CaptureFacts): { ok: boolean; problems: CaptureProblem[] } {
  const L = SupercargoCaptureLimits;
  const problems: CaptureProblem[] = [];
  const captured = f.capturedAt.getTime();
  if (f.source !== 'camera') problems.push('library_photo');
  if (!f.nonceIssuedAt) problems.push('no_nonce');
  else {
    const age = captured - f.nonceIssuedAt.getTime();
    if (age < -5000 || age > L.nonceMaxAgeMs) problems.push('stale_nonce');
  }
  const delay = f.submittedAt.getTime() - captured;
  if (delay < -5000) problems.push('clock');
  else if (delay > L.submitMaxDelayMs) problems.push('late_submit');
  if (!f.fix) problems.push('no_fix');
  else {
    if (!(f.fix.accuracyM > 0) || f.fix.accuracyM > L.fixMaxAccuracyM) problems.push('weak_fix');
    if (Math.abs(f.fix.at.getTime() - captured) > L.fixMaxSkewMs) problems.push('stale_fix');
    if (f.previous) {
      const km = distanceMeters(f.previous, f.fix) / 1000;
      const hours = Math.max(1 / 60, (captured - f.previous.at.getTime()) / 3600_000);
      if (km > 1 && km / hours > L.maxImpliedKph) problems.push('teleport');
    }
  }
  if (f.creditedToday >= L.creditedPerDay) problems.push('daily_limit');
  if (f.duplicateImage) problems.push('duplicate');
  return { ok: problems.length === 0, problems };
}

export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Envelopes: sealed folios left at curated public places.
// ---------------------------------------------------------------------------

export const SupercargoAnchorKinds = ['route_start', 'route_finish', 'overlook', 'venue', 'museum', 'event'] as const;
export type SupercargoAnchorKind = (typeof SupercargoAnchorKinds)[number];

export const SupercargoEnvelopeLimits = { radiusM: 60, maxAccuracyM: 50, nearbyKm: 5 } as const;

export type EnvelopeRefusal = 'weak_fix' | 'too_far' | 'closed' | 'empty' | 'already';

export function envelopeRefusal(input: {
  distanceM: number;
  accuracyM: number;
  now: Date;
  opensAt: Date;
  closesAt: Date;
  stock: number;
  claimed: number;
  alreadyClaimed: boolean;
}): EnvelopeRefusal | null {
  if (input.alreadyClaimed) return 'already';
  if (input.now < input.opensAt || input.now >= input.closesAt) return 'closed';
  if (input.claimed >= input.stock) return 'empty';
  if (!(input.accuracyM > 0) || input.accuracyM > SupercargoEnvelopeLimits.maxAccuracyM) return 'weak_fix';
  if (input.distanceM > SupercargoEnvelopeLimits.radiusM) return 'too_far';
  return null;
}

// ---------------------------------------------------------------------------
// The Exchange: folio for folio, between members, no money.
// ---------------------------------------------------------------------------

export interface SupercargoFolio {
  id: string;
  owner: string;
  origin: 'sighting' | 'envelope';
  tier: SupercargoTier;
  acquiredAt: Date;
}

export const SupercargoExchangeLimits = {
  maxPerSide: 3,
  settleHours: 24,
  maxOpenOffers: 5,
  singularTenureDays: 30,
} as const;

export type ExchangeProblem =
  | 'self'
  | 'size'
  | 'not_yours'
  | 'not_theirs'
  | 'sighting_folio'
  | 'settling'
  | 'duplicate'
  | 'open_offers'
  | 'tenure';

export function exchangeProblems(input: {
  proposer: string;
  counterparty: string;
  offered: SupercargoFolio[];
  requested: SupercargoFolio[];
  now: Date;
  proposerOpenOffers: number;
  proposerTenureDays: number;
  counterpartyTenureDays: number;
}): ExchangeProblem[] {
  const L = SupercargoExchangeLimits;
  const p: ExchangeProblem[] = [];
  const all = [...input.offered, ...input.requested];
  if (input.proposer === input.counterparty) p.push('self');
  if (!input.offered.length || !input.requested.length || input.offered.length > L.maxPerSide || input.requested.length > L.maxPerSide) p.push('size');
  if (new Set(all.map((f) => f.id)).size !== all.length) p.push('duplicate');
  if (input.offered.some((f) => f.owner !== input.proposer)) p.push('not_yours');
  if (input.requested.some((f) => f.owner !== input.counterparty)) p.push('not_theirs');
  // A sighting folio is evidence of something a member saw. It does not change hands.
  if (all.some((f) => f.origin === 'sighting')) p.push('sighting_folio');
  if (all.some((f) => input.now.getTime() - f.acquiredAt.getTime() < L.settleHours * 3600_000)) p.push('settling');
  if (input.proposerOpenOffers >= L.maxOpenOffers) p.push('open_offers');
  if (all.some((f) => f.tier === 'singular') && Math.min(input.proposerTenureDays, input.counterpartyTenureDays) < L.singularTenureDays) p.push('tenure');
  return p;
}

// ---------------------------------------------------------------------------
// Commissions: a few weekly objectives. Counts only. Never speed, never time.
// ---------------------------------------------------------------------------

export type CommissionRule =
  | { kind: 'sightings'; minTier: SupercargoTier; count: number }
  | { kind: 'distinct_makes'; count: number }
  | { kind: 'distinct_cells'; count: number }
  | { kind: 'envelopes'; count: number };

export interface LedgerEvent {
  origin: 'sighting' | 'envelope';
  tier: SupercargoTier;
  make: string;
  cellId: string | null;
  at: Date;
}

export function tierAtLeast(tier: SupercargoTier, min: SupercargoTier) {
  return SupercargoTiers.indexOf(tier) >= SupercargoTiers.indexOf(min);
}

/** Monday 00:00 UTC of the week containing `at`. */
export function commissionWeekStart(at: Date): Date {
  const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d;
}

export function commissionProgress(rule: CommissionRule, events: LedgerEvent[], week: Date) {
  const start = commissionWeekStart(week).getTime();
  const inWeek = events.filter((e) => e.at.getTime() >= start && e.at.getTime() < start + 7 * 86400_000);
  let have = 0;
  switch (rule.kind) {
    case 'sightings':
      have = inWeek.filter((e) => e.origin === 'sighting' && tierAtLeast(e.tier, rule.minTier)).length;
      break;
    case 'distinct_makes':
      have = new Set(inWeek.filter((e) => e.origin === 'sighting').map((e) => e.make.trim().toLowerCase())).size;
      break;
    case 'distinct_cells':
      have = new Set(inWeek.filter((e) => e.origin === 'sighting' && e.cellId).map((e) => e.cellId)).size;
      break;
    case 'envelopes':
      have = inWeek.filter((e) => e.origin === 'envelope').length;
      break;
  }
  return { have: Math.min(have, rule.count), need: rule.count, complete: have >= rule.count };
}

// ---------------------------------------------------------------------------
// Reports and moderation.
// ---------------------------------------------------------------------------

export const SupercargoReportReasons = [
  'plate_visible',
  'face_visible',
  'residential',
  'owner_request',
  'stalking',
  'wrong_model',
  'not_original',
  'spam',
] as const;
export type SupercargoReportReason = (typeof SupercargoReportReasons)[number];

/** Safety reasons take a sighting off the map on the first report. */
export const SupercargoSafetyReasons: readonly SupercargoReportReason[] = [
  'plate_visible',
  'face_visible',
  'residential',
  'owner_request',
  'stalking',
];
export const SUPERCARGO_REPORT_THRESHOLD = 3;

export function reportHolds(reason: SupercargoReportReason, distinctReporters: number) {
  return SupercargoSafetyReasons.includes(reason) || distinctReporters >= SUPERCARGO_REPORT_THRESHOLD;
}
