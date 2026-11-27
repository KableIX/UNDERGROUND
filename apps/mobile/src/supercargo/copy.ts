import { SupercargoTierLabels, SupercargoTierNotes, SupercargoTiers, type SupercargoTier } from '@underground/domain';

/** SupercarGO words. Quiet, certain, short. No points, no streaks, no confetti. */
export const supercargoCopy = {
  name: 'SupercarGO',
  tagline: 'Sightings, envelopes and the Ledger.',
  optIn: 'SupercarGO is off until you turn it on. Your location stays private either way.',
  mapNote: 'Shown hours after the car has gone, at neighborhood scale. Members only.',
  captureNote: 'Fresh captures only. Plates and faces are blurred before anything is shared.',
  ledgerEmpty: 'The Ledger is empty. It fills one sighting at a time.',
  exchangeNote: 'Envelope folios can be exchanged, folio for folio, after 24 hours. Sightings stay with the member who saw them.',
  commissionsNote: 'This week\'s commissions. Counts only.',
  commissionsEmpty: 'No commissions posted this week.',
  exchangeEmpty: 'No offers yet. Propose one with a member\'s number.',
  mapEmpty: 'Nothing nearby in the last three days.',
  offline: 'Turn on SupercarGO to see sightings, envelopes and the Ledger.',
  originalKept: 'The original stays on your phone. Only a blurred copy is shared.',
  clubNote: 'Combined marks of everyone in the club. No member is ranked.',
} as const;

export const supercargoSections = ['map', 'ledger', 'exchange'] as const;
export type SupercargoSection = (typeof supercargoSections)[number];
export const supercargoSectionLabels: Record<SupercargoSection, string> = { map: 'Map', ledger: 'Ledger', exchange: 'Exchange' };

export function parseSection(value: unknown): SupercargoSection {
  return supercargoSections.includes(value as SupercargoSection) ? (value as SupercargoSection) : 'map';
}

/** Toggle a folio in a selection of at most three. */
export function toggleFolio(selected: string[], id: string, max = 3) {
  if (selected.includes(id)) return selected.filter((x) => x !== id);
  return selected.length >= max ? selected : [...selected, id];
}

export function exchangeStatusText(status: string, incoming: boolean) {
  switch (status) {
    case 'open':
      return incoming ? 'Waiting for you' : 'Waiting for them';
    case 'accepted':
      return 'Exchanged';
    case 'declined':
      return 'Declined';
    case 'withdrawn':
      return 'Withdrawn';
    default:
      return 'No longer valid';
  }
}

const reasonText: Record<string, string> = {
  meet: 'Logged at a curated meet. Members see it in an hour, at neighborhood scale.',
  library_photo: 'Kept private. Library photos earn no folio.',
  home_zone: 'Logged privately. It was near a member\'s home.',
  owner_opt_out: 'Logged privately. The owner has opted out.',
  own_car: 'Your own car. Logged privately, no folio.',
  redaction_failed: 'Logged privately. It could not be blurred with certainty.',
  redaction_pending: 'Held while plates and faces are blurred.',
};

export function tierLabel(tier: SupercargoTier) {
  return SupercargoTierLabels[tier];
}

export function tierNote(tier: SupercargoTier) {
  return SupercargoTierNotes[tier];
}

/** Rank from 1 (Open) to 6 (Singular), shown as hairline ticks, never as points. */
export function tierRank(tier: SupercargoTier) {
  return SupercargoTiers.indexOf(tier) + 1;
}

export function sightingOutcome(
  result: { visibility: string; reason: string | null; publishAt: string | null; folio: boolean; atMeet?: boolean },
  now = new Date(),
) {
  if (result.visibility === 'public' && result.atMeet) return reasonText.meet! + (result.folio ? ' Added to the Ledger.' : '');
  if (result.visibility === 'public' && result.publishAt) {
    const hours = Math.max(1, Math.round((new Date(result.publishAt).getTime() - now.getTime()) / 3600_000));
    return `Logged. Members see it in ${hours} hours, at neighborhood scale.` + (result.folio ? ' Added to the Ledger.' : '');
  }
  return (result.reason && reasonText[result.reason]) || 'Logged privately.';
}

export function groupByTier<T extends { tier: SupercargoTier }>(items: T[]) {
  return [...SupercargoTiers]
    .reverse()
    .map((tier) => ({ tier, items: items.filter((i) => i.tier === tier) }))
    .filter((g) => g.items.length > 0);
}

// ---- Reports and moderation ----

export const reportReasonText: Record<string, { label: string; detail: string }> = {
  plate_visible: { label: 'A plate is readable', detail: 'Taken off the map at once.' },
  face_visible: { label: 'A face is visible', detail: 'Taken off the map at once.' },
  residential: { label: 'It is at someone’s home', detail: 'Taken off the map at once.' },
  owner_request: { label: 'It is my car', detail: 'Taken off the map at once.' },
  stalking: { label: 'Someone is being followed', detail: 'Taken off the map at once.' },
  wrong_model: { label: 'Wrong model', detail: 'Reviewed after three reports.' },
  not_original: { label: 'Not the member’s photo', detail: 'Reviewed after three reports.' },
  spam: { label: 'Spam', detail: 'Reviewed after three reports.' },
};

export function decisionText(status: string) {
  switch (status) {
    case 'held':
      return 'Off the map, under review';
    case 'restore':
      return 'Back on the map';
    case 'remove':
      return 'Removed';
    case 'correct_model':
      return 'Model corrected';
    default:
      return status;
  }
}

// ---- Map: reload as you pan ----

export type Bounds = { west: number; south: number; east: number; north: number };
export const MAP_MAX_SPAN = 1.2;

/**
 * Bounds to query for what is on screen, padded a quarter each side and capped
 * at MAP_MAX_SPAN degrees. Returns null when the last query already covers it.
 */
export function mapQueryBounds(previous: Bounds | null, visible: Bounds): Bounds | null {
  if (
    previous &&
    visible.west >= previous.west &&
    visible.east <= previous.east &&
    visible.south >= previous.south &&
    visible.north <= previous.north
  ) {
    return null;
  }
  const cx = (visible.west + visible.east) / 2;
  const cy = (visible.south + visible.north) / 2;
  const w = Math.min(MAP_MAX_SPAN, (visible.east - visible.west) * 1.5) / 2;
  const h = Math.min(MAP_MAX_SPAN, (visible.north - visible.south) * 1.5) / 2;
  return { west: cx - w, east: cx + w, south: Math.max(-90, cy - h), north: Math.min(90, cy + h) };
}

// ---- Admin helpers ----

export function anchorSlug(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Monday (UTC) of the week containing the date, as YYYY-MM-DD. */
export function weekStartOf(date: Date, weeksAhead = 0) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + weeksAhead * 7);
  return d.toISOString().slice(0, 10);
}

export const anchorKinds = ['curated_meet', 'overlook', 'route_start', 'route_finish', 'venue', 'museum', 'event'] as const;
export const anchorKindLabels: Record<string, string> = {
  curated_meet: 'Curated meet',
  overlook: 'Overlook',
  route_start: 'Route start',
  route_finish: 'Route finish',
  venue: 'Venue',
  museum: 'Museum',
  event: 'Event',
};

export function anchorProblems(form: { name: string; lat: string; lng: string; publicPlace: boolean }) {
  const problems: string[] = [];
  if (anchorSlug(form.name).length < 2) problems.push('Name the place.');
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  if (!form.lat || !Number.isFinite(lat) || lat < -90 || lat > 90) problems.push('Latitude is between -90 and 90.');
  if (!form.lng || !Number.isFinite(lng) || lng < -180 || lng > 180) problems.push('Longitude is between -180 and 180.');
  if (!form.publicPlace) problems.push('Confirm it is a public place, not a residential street.');
  return problems;
}
