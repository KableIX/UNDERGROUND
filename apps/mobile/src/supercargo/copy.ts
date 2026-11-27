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
