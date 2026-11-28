import {
  computeRarity,
  findSupercargoEntry,
  supercargoSeedCatalog,
  SupercargoTierLabels,
  type SupercargoCatalogEntry,
  type SupercargoTier,
} from '@underground/domain';

/**
 * Pure helpers for the capture flow: scan -> reveal -> card. Nothing here
 * touches the camera, the network or the location. The identification itself
 * comes from the vision model behind /v1/spotted/identify; these helpers only
 * match what it said to the catalog and decide how sure the screen may sound.
 */

export type Finish = 'holo' | 'sheen' | 'matte';

/** Atelier and Singular get the full holographic foil, Numbered and Allocated a foil edge. */
export function finishFor(tier: SupercargoTier): Finish {
  if (tier === 'atelier' || tier === 'singular') return 'holo';
  if (tier === 'numbered' || tier === 'allocated') return 'sheen';
  return 'matte';
}

export type CatalogMatch = { entry: SupercargoCatalogEntry; tier: SupercargoTier };

export function catalogTier(entry: SupercargoCatalogEntry, asOfYear = new Date().getFullYear()): SupercargoTier {
  return computeRarity({ built: entry.built, firstYear: entry.firstYear, asOfYear }).tier;
}

export function matchCatalog(make: string, model: string, asOfYear?: number): CatalogMatch | null {
  const entry = findSupercargoEntry(make, model);
  return entry ? { entry, tier: catalogTier(entry, asOfYear) } : null;
}

export function catalogById(id: string | null | undefined): SupercargoCatalogEntry | null {
  return (id && supercargoSeedCatalog.find((e) => e.id === id)) || null;
}

export type Identification = {
  make: string;
  model: string;
  confidence?: number | null;
  candidates?: Array<{ make: string; model: string; confidence?: number | null }>;
};

export type Candidate = { make: string; model: string; confidence: number | null; match: CatalogMatch | null };

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function clampConfidence(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null;
}

/**
 * The model's answer first, then its alternatives, at most three, one per car.
 * A catalog match uses the catalog's spelling so the Ledger and the card agree.
 */
export function rankCandidates(id: Identification, asOfYear?: number): Candidate[] {
  const raw = [
    { make: id.make, model: id.model, confidence: id.confidence },
    ...(id.candidates ?? []).filter((c) => !(norm(c.make) === norm(id.make) && norm(c.model) === norm(id.model))),
  ];
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const c of raw) {
    if (!c.make?.trim() || !c.model?.trim()) continue;
    const match = matchCatalog(c.make, c.model, asOfYear);
    const key = match ? match.entry.id : norm(c.make) + '|' + norm(c.model);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      make: match ? match.entry.make : c.make.trim(),
      model: match ? match.entry.model : c.model.trim(),
      confidence: clampConfidence(c.confidence),
      match,
    });
    if (out.length === 3) break;
  }
  return out;
}

export type Cue = { level: 'strong' | 'likely' | 'unsure'; label: string; detail: string };

/**
 * How sure the reveal may sound. The number is the vision model's own estimate,
 * not a calibrated probability, so the words stay modest.
 */
export function confidenceCue(top: Candidate | undefined): Cue {
  if (!top) return { level: 'unsure', label: 'No clear match', detail: 'Enter the make and model.' };
  const c = top.confidence;
  if (c === null) {
    return top.match
      ? { level: 'likely', label: 'Catalog match', detail: 'AI identification. Check it before you log.' }
      : { level: 'unsure', label: 'Not in the catalog', detail: 'It logs as Open. Correct it if the AI missed.' };
  }
  const pct = Math.round(c * 100) + '%';
  if (c >= 0.8 && top.match) return { level: 'strong', label: 'Strong match', detail: `AI estimate ${pct}.` };
  if (c >= 0.55) return { level: 'likely', label: 'Likely match', detail: `AI estimate ${pct}. Check it before you log.` };
  return { level: 'unsure', label: 'Not certain', detail: `AI estimate ${pct}. Pick the right car.` };
}

/** Show the candidate picker when the top answer is unsure or the runner-up is close. */
export function needsChoice(cands: Candidate[]): boolean {
  if (cands.length === 0) return true;
  if (confidenceCue(cands[0]).level === 'unsure') return true;
  const [a, b] = cands;
  return !!(b && a?.confidence !== null && b.confidence !== null && a!.confidence! - b.confidence! < 0.15);
}

/** Catalog cars of the same make, closest name first, for the edit hint. */
export function similarInCatalog(make: string, model: string, limit = 3): SupercargoCatalogEntry[] {
  const m = norm(make);
  const words = new Set(norm(model).split(' ').filter(Boolean));
  if (!m) return [];
  return supercargoSeedCatalog
    .filter((e) => norm(e.make) === m)
    .map((e) => ({ e, score: norm(e.model).split(' ').filter((w) => words.has(w)).length }))
    .sort((a, b) => b.score - a.score || a.e.model.localeCompare(b.e.model))
    .slice(0, limit)
    .map((x) => x.e);
}

const fmt = (n: number) => n.toLocaleString('en-US');

export function productionLine(entry: SupercargoCatalogEntry | null): string {
  if (!entry || entry.built === null) return 'Not published';
  const planned = /planned/i.test(entry.builtSource ?? '');
  if (planned) return `${fmt(entry.built)} planned`;
  if (entry.built <= 10) return `Only ${fmt(entry.built)} built`;
  if (entry.built < 100) return `Fewer than 100 built · ${fmt(entry.built)}`;
  return `${fmt(entry.built)} built`;
}

export function yearLine(entry: SupercargoCatalogEntry | null): string | null {
  return entry?.firstYear ? `From ${entry.firstYear}` : null;
}

export function ordinal(n: number): string {
  const v = n % 100;
  const suffix = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

export function spotLine(n: number | null, model: string): string | null {
  return n && n > 0 ? `Your ${ordinal(n)} ${model}` : null;
}

export function serial(n: number | null): string {
  return n && n > 0 ? 'No. ' + String(n).padStart(2, '0') : 'No. —';
}

const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export function spotDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/**
 * Neighborhood or town only. Street, number, name and postal code are never read,
 * and the input is the fuzzed cell center, not the capture point.
 */
export function areaLabel(
  place: { district?: string | null; city?: string | null; subregion?: string | null } | null | undefined,
): string | null {
  const v = place?.district?.trim() || place?.city?.trim() || place?.subregion?.trim();
  return v ? v.slice(0, 40) : null;
}

/** Share text. No place, no time of day, nothing that points at the car now. */
export function shareMessage(card: { make: string; model: string; tier: SupercargoTier; entry: SupercargoCatalogEntry | null }): string {
  return `${card.make} ${card.model} · ${SupercargoTierLabels[card.tier]} · ${productionLine(card.entry)}. Spotted on UNDERGROUND.`;
}
