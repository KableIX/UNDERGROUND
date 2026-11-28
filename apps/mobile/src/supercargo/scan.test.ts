import { describe, expect, it } from 'vitest';
import { supercargoSeedCatalog } from '@underground/domain';
import {
  areaLabel,
  catalogTier,
  confidenceCue,
  finishFor,
  matchCatalog,
  needsChoice,
  ordinal,
  productionLine,
  rankCandidates,
  serial,
  shareMessage,
  similarInCatalog,
  spotLine,
} from './scan';

const entry = (id: string) => supercargoSeedCatalog.find((e) => e.id === id)!;

describe('SupercarGO scan helpers', () => {
  it('gives foil only to the rare tiers', () => {
    expect(finishFor('singular')).toBe('holo');
    expect(finishFor('atelier')).toBe('holo');
    expect(finishFor('allocated')).toBe('sheen');
    expect(finishFor('numbered')).toBe('sheen');
    expect(finishFor('limited')).toBe('matte');
    expect(finishFor('open')).toBe('matte');
  });

  it('matches the model answer to the catalog spelling and tier', () => {
    const m = matchCatalog('bugatti', 'bolide', 2026);
    expect(m?.entry.id).toBe('bugatti-bolide');
    expect(m?.tier).toBe('atelier');
    expect(catalogTier(entry('ferrari-f40'), 2026)).toBe('numbered');
  });

  it('keeps the model order, drops duplicates and caps at three', () => {
    const c = rankCandidates(
      {
        make: 'Ferrari',
        model: 'F40',
        confidence: 0.62,
        candidates: [
          { make: 'ferrari', model: 'f40', confidence: 0.6 },
          { make: 'Ferrari', model: 'F50', confidence: 0.3 },
          { make: 'Ferrari', model: '288 GTO', confidence: 0.2 },
          { make: 'Ferrari', model: 'Enzo', confidence: 0.1 },
        ],
      },
      2026,
    );
    expect(c.map((x) => x.model)).toEqual(['F40', 'F50', '288 GTO']);
    expect(c[0]!.match?.entry.id).toBe('ferrari-f40');
  });

  it('never sounds surer than the model, and says so when it gave no score', () => {
    expect(confidenceCue(undefined).level).toBe('unsure');
    const [strong] = rankCandidates({ make: 'Bugatti', model: 'Chiron', confidence: 0.92 });
    expect(confidenceCue(strong).level).toBe('strong');
    const [unscored] = rankCandidates({ make: 'Bugatti', model: 'Chiron' });
    expect(confidenceCue(unscored)).toMatchObject({ level: 'likely', label: 'Catalog match' });
    const [unknown] = rankCandidates({ make: 'Honda', model: 'Civic' });
    expect(confidenceCue(unknown).level).toBe('unsure');
    const [low] = rankCandidates({ make: 'Bugatti', model: 'Chiron', confidence: 0.4 });
    expect(confidenceCue(low).level).toBe('unsure');
  });

  it('asks the member to choose when unsure or when the runner-up is close', () => {
    expect(needsChoice([])).toBe(true);
    expect(needsChoice(rankCandidates({ make: 'Bugatti', model: 'Chiron', confidence: 0.95 }))).toBe(false);
    expect(
      needsChoice(rankCandidates({ make: 'Ferrari', model: 'F40', confidence: 0.7, candidates: [{ make: 'Ferrari', model: 'F50', confidence: 0.62 }] })),
    ).toBe(true);
  });

  it('suggests catalog cars of the same make for a correction', () => {
    expect(similarInCatalog('Ferrari', 'SF90 XX').map((e) => e.id)).toContain('ferrari-sf90-xx-stradale');
    expect(similarInCatalog('', 'x')).toEqual([]);
  });

  it('writes production from the catalog, planned runs included, nothing estimated', () => {
    expect(productionLine(entry('bugatti-bolide'))).toBe('Fewer than 100 built · 40');
    expect(productionLine(entry('ferrari-f40'))).toBe('1,311 built');
    expect(productionLine(entry('bugatti-tourbillon'))).toBe('250 planned');
    expect(productionLine(entry('ferrari-roma'))).toBe('Not published');
    expect(productionLine(null)).toBe('Not published');
  });

  it('numbers the member spot', () => {
    expect(['1', '2', '3', '4', '11', '12', '13', '21', '102'].map((n) => ordinal(Number(n)))).toEqual(
      ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '102nd'],
    );
    expect(spotLine(3, 'F40')).toBe('Your 3rd F40');
    expect(spotLine(null, 'F40')).toBeNull();
    expect(serial(7)).toBe('No. 07');
  });

  it('only ever names a neighborhood or town', () => {
    expect(areaLabel({ district: 'Woodside', city: 'Redwood City' })).toBe('Woodside');
    expect(areaLabel({ city: 'Palo Alto', subregion: 'Santa Clara County' })).toBe('Palo Alto');
    expect(areaLabel({ street: '1 Main St', name: '1 Main St' } as never)).toBeNull();
    expect(areaLabel(null)).toBeNull();
  });

  it('shares no location', () => {
    const text = shareMessage({ make: 'Bugatti', model: 'Bolide', tier: 'atelier', entry: entry('bugatti-bolide') });
    expect(text).toBe('Bugatti Bolide · Atelier · Fewer than 100 built · 40. Spotted on UNDERGROUND.');
  });
});
