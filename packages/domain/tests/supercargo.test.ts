import { describe, expect, it } from 'vitest';
import {
  catalogEntryProblems,
  commissionProgress,
  commissionWeekStart,
  computeRarity,
  decidePublication,
  distanceMeters,
  drawEnvelopeContents,
  hashDistance,
  envelopeRefusal,
  exchangeProblems,
  fuzzToCell,
  publicWindow,
  reportHolds,
  SupercargoScoreBands,
  tierForEffective,
  verifyCapture,
  type SupercargoFolio,
} from '../src/supercargo';
import { findSupercargoEntry, supercargoSeedCatalog } from '../src/supercargo-catalog';

describe('SupercarGO rarity', () => {
  it('maps production to tiers at the boundaries', () => {
    expect(tierForEffective(1)).toBe('singular');
    expect(tierForEffective(10)).toBe('singular');
    expect(tierForEffective(11)).toBe('atelier');
    expect(tierForEffective(100)).toBe('atelier');
    expect(tierForEffective(101)).toBe('allocated');
    expect(tierForEffective(500)).toBe('allocated');
    expect(tierForEffective(501)).toBe('numbered');
    expect(tierForEffective(2000)).toBe('numbered');
    expect(tierForEffective(2001)).toBe('limited');
    expect(tierForEffective(15000)).toBe('limited');
    expect(tierForEffective(15001)).toBe('open');
    expect(tierForEffective(null)).toBe('open');
  });

  it('keeps unsourced cars Open and provisional', () => {
    expect(computeRarity({ built: null, firstYear: 2010, asOfYear: 2026 })).toEqual({ tier: 'open', score: 0, effective: null, provisional: true });
  });

  it('counts attrition for older cars', () => {
    expect(computeRarity({ built: 1311, firstYear: 1987, asOfYear: 2026 }).tier).toBe('numbered');
    expect(computeRarity({ built: 106, firstYear: 1992, asOfYear: 2026 }).tier).toBe('atelier');
    expect(computeRarity({ built: 400, firstYear: 2002, asOfYear: 2026 }).effective).toBe(320);
  });

  it('never lets the score leave the tier band, whatever members report', () => {
    for (const built of [1, 9, 10, 11, 99, 100, 101, 499, 500, 501, 1999, 2000, 2001, 14999, 15000, 15001, 90000]) {
      for (const seen of [0, 5, 500, 50000]) {
        const r = computeRarity({ built, firstYear: 2020, asOfYear: 2026, memberSightings90d: seen, garageCount: seen });
        const [low, high] = SupercargoScoreBands[r.tier];
        expect(r.score).toBeGreaterThanOrEqual(low);
        expect(r.score).toBeLessThanOrEqual(high);
      }
    }
  });

  it('orders a frequently seen car below a rarely seen one in the same tier', () => {
    const quiet = computeRarity({ built: 300, firstYear: 2020, asOfYear: 2026, memberSightings90d: 0 });
    const busy = computeRarity({ built: 300, firstYear: 2020, asOfYear: 2026, memberSightings90d: 400 });
    expect(busy.tier).toBe(quiet.tier);
    expect(busy.score).toBeLessThan(quiet.score);
  });

  it('requires a source for every production number in the seed catalog', () => {
    for (const entry of supercargoSeedCatalog) expect(catalogEntryProblems(entry)).toEqual([]);
    expect(catalogEntryProblems({ id: 'x-y', make: 'X', model: 'Y', built: 10, builtSource: null, firstYear: 2020 })).toContain('built_source');
    expect(findSupercargoEntry('Porsche', '918 spyder')?.id).toBe('porsche-918-spyder');
    expect(findSupercargoEntry('Lamborghini', 'Huracan')?.id).toBe('lamborghini-huracan');
    expect(findSupercargoEntry('', 'R8')).toBeNull();
  });
});

describe('SupercarGO theft safety', () => {
  it('snaps a sighting to a neighborhood cell and never returns the point', () => {
    const a = fuzzToCell(37.33182, -121.88633, 'numbered');
    const b = fuzzToCell(37.3325, -121.8871, 'numbered');
    expect(a.id).toBe(b.id);
    expect(distanceMeters({ lat: 37.33182, lng: -121.88633 }, a)).toBeGreaterThan(50);
    expect(distanceMeters({ lat: 37.33182, lng: -121.88633 }, a)).toBeLessThan(2500);
  });

  it('uses a district-sized cell and a longer hold for the rarest cars', () => {
    expect(fuzzToCell(37.3, -121.9, 'singular').stepDeg).toBe(0.1);
    const at = new Date('2026-11-27T12:00:00Z');
    expect(publicWindow(at, 'open').publishAt.toISOString()).toBe('2026-11-27T18:00:00.000Z');
    expect(publicWindow(at, 'singular').publishAt.toISOString()).toBe('2026-11-28T12:00:00.000Z');
    expect(publicWindow(at, 'open').expiresAt.toISOString()).toBe('2026-11-30T12:00:00.000Z');
  });

  const base = { source: 'camera' as const, redaction: 'done' as const, nearHomeZone: false, ownerOptedOut: false, spottersOwnCar: false, captureVerified: true };
  it('publishes only when every check passes', () => {
    expect(decidePublication(base)).toEqual({ visibility: 'public', credited: true });
    expect(decidePublication({ ...base, source: 'library' })).toMatchObject({ visibility: 'private', credited: false });
    expect(decidePublication({ ...base, spottersOwnCar: true })).toMatchObject({ visibility: 'private', credited: false, reason: 'own_car' });
    expect(decidePublication({ ...base, nearHomeZone: true })).toMatchObject({ visibility: 'private', reason: 'home_zone' });
    expect(decidePublication({ ...base, ownerOptedOut: true })).toMatchObject({ visibility: 'private', reason: 'owner_opt_out' });
    expect(decidePublication({ ...base, redaction: 'pending' })).toMatchObject({ visibility: 'held' });
    expect(decidePublication({ ...base, redaction: 'failed' })).toMatchObject({ visibility: 'private' });
    expect(decidePublication({ ...base, captureVerified: false })).toMatchObject({ visibility: 'private', credited: false });
  });
});

describe('SupercarGO capture checks', () => {
  const now = new Date('2026-11-27T12:00:00Z');
  const good = {
    source: 'camera' as const,
    nonceIssuedAt: new Date(now.getTime() - 60_000),
    capturedAt: now,
    submittedAt: new Date(now.getTime() + 20_000),
    fix: { lat: 37.33, lng: -121.88, accuracyM: 12, at: now },
    previous: { lat: 37.4, lng: -121.9, at: new Date(now.getTime() - 3600_000) },
    creditedToday: 2,
    duplicateImage: false,
  };
  it('accepts a fresh camera capture with a good fix', () => {
    expect(verifyCapture(good)).toEqual({ ok: true, problems: [] });
  });
  it('refuses library photos, stale nonces, weak fixes, teleports and duplicates', () => {
    expect(verifyCapture({ ...good, source: 'library' }).problems).toContain('library_photo');
    expect(verifyCapture({ ...good, nonceIssuedAt: new Date(now.getTime() - 10 * 60_000) }).problems).toContain('stale_nonce');
    expect(verifyCapture({ ...good, nonceIssuedAt: null }).problems).toContain('no_nonce');
    expect(verifyCapture({ ...good, fix: { ...good.fix, accuracyM: 400 } }).problems).toContain('weak_fix');
    expect(verifyCapture({ ...good, fix: null }).problems).toContain('no_fix');
    expect(verifyCapture({ ...good, previous: { lat: 34.05, lng: -118.24, at: new Date(now.getTime() - 10 * 60_000) } }).problems).toContain('teleport');
    expect(verifyCapture({ ...good, duplicateImage: true }).problems).toContain('duplicate');
    expect(verifyCapture({ ...good, creditedToday: 30 }).problems).toContain('daily_limit');
    expect(verifyCapture({ ...good, submittedAt: new Date(now.getTime() + 31 * 60_000) }).problems).toContain('late_submit');
  });
});

describe('SupercarGO envelopes and the Exchange', () => {
  const now = new Date('2026-11-27T12:00:00Z');
  const env = { now, opensAt: new Date(now.getTime() - 1000), closesAt: new Date(now.getTime() + 3600_000), stock: 3, claimed: 0, alreadyClaimed: false };
  it('requires presence within 60 m on a good fix', () => {
    expect(envelopeRefusal({ ...env, distanceM: 40, accuracyM: 10 })).toBeNull();
    expect(envelopeRefusal({ ...env, distanceM: 80, accuracyM: 10 })).toBe('too_far');
    expect(envelopeRefusal({ ...env, distanceM: 10, accuracyM: 80 })).toBe('weak_fix');
    expect(envelopeRefusal({ ...env, distanceM: 10, accuracyM: 10, claimed: 3 })).toBe('empty');
    expect(envelopeRefusal({ ...env, distanceM: 10, accuracyM: 10, alreadyClaimed: true })).toBe('already');
  });

  const old = new Date(now.getTime() - 48 * 3600_000);
  const f = (id: string, owner: string, extra: Partial<SupercargoFolio> = {}): SupercargoFolio => ({ id, owner, origin: 'envelope', tier: 'numbered', acquiredAt: old, ...extra });
  const offer = { proposer: 'a', counterparty: 'b', now, proposerOpenOffers: 0, proposerTenureDays: 60, counterpartyTenureDays: 60 };
  it('allows a clean folio-for-folio exchange', () => {
    expect(exchangeProblems({ ...offer, offered: [f('1', 'a')], requested: [f('2', 'b')] })).toEqual([]);
  });
  it('keeps sighting folios, fresh folios and new members out of the Exchange', () => {
    expect(exchangeProblems({ ...offer, offered: [f('1', 'a', { origin: 'sighting' })], requested: [f('2', 'b')] })).toContain('sighting_folio');
    expect(exchangeProblems({ ...offer, offered: [f('1', 'a', { acquiredAt: now })], requested: [f('2', 'b')] })).toContain('settling');
    expect(exchangeProblems({ ...offer, counterpartyTenureDays: 3, offered: [f('1', 'a', { tier: 'singular' })], requested: [f('2', 'b')] })).toContain('tenure');
    expect(exchangeProblems({ ...offer, offered: [f('1', 'b')], requested: [f('2', 'a')] })).toEqual(expect.arrayContaining(['not_yours', 'not_theirs']));
    expect(exchangeProblems({ ...offer, counterparty: 'a', offered: [f('1', 'a')], requested: [f('2', 'a')] })).toContain('self');
    expect(exchangeProblems({ ...offer, offered: [f('1', 'a'), f('3', 'a'), f('4', 'a'), f('5', 'a')], requested: [f('2', 'b')] })).toContain('size');
  });
});

describe('SupercarGO commissions and reports', () => {
  it('counts the week from Monday and ignores anything outside it', () => {
    expect(commissionWeekStart(new Date('2026-11-27T12:00:00Z')).toISOString()).toBe('2026-11-23T00:00:00.000Z');
    const at = new Date('2026-11-25T10:00:00Z');
    const events = [
      { origin: 'sighting' as const, tier: 'numbered' as const, make: 'Porsche', cellId: 'c1', at },
      { origin: 'sighting' as const, tier: 'open' as const, make: 'Audi', cellId: 'c2', at },
      { origin: 'sighting' as const, tier: 'atelier' as const, make: 'Porsche', cellId: 'c1', at: new Date('2026-11-20T10:00:00Z') },
      { origin: 'envelope' as const, tier: 'limited' as const, make: 'Ford', cellId: null, at },
    ];
    expect(commissionProgress({ kind: 'sightings', minTier: 'numbered', count: 2 }, events, at)).toEqual({ have: 1, need: 2, complete: false });
    expect(commissionProgress({ kind: 'distinct_makes', count: 2 }, events, at).complete).toBe(true);
    expect(commissionProgress({ kind: 'distinct_cells', count: 2 }, events, at).complete).toBe(true);
    expect(commissionProgress({ kind: 'envelopes', count: 1 }, events, at).complete).toBe(true);
  });
  it('takes a sighting down on the first safety report', () => {
    expect(reportHolds('plate_visible', 1)).toBe(true);
    expect(reportHolds('wrong_model', 1)).toBe(false);
    expect(reportHolds('wrong_model', 3)).toBe(true);
  });
});

describe('SupercarGO curated meets, envelopes and hashes', () => {
  it('shows curated-meet sightings after one hour, still as a cell', () => {
    const at = new Date('2026-11-27T12:00:00Z');
    expect(publicWindow(at, 'singular', true).publishAt.toISOString()).toBe('2026-11-27T13:00:00.000Z');
    expect(fuzzToCell(37.3, -121.9, 'singular').stepDeg).toBe(0.1);
  });

  it('draws envelopes by rarity, with the featured car about one time in ten', () => {
    const catalog = [
      { id: 'a', tier: 'open' as const },
      { id: 'b', tier: 'numbered' as const },
      { id: 'c', tier: 'singular' as const },
    ];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 6000; i++) counts[drawEnvelopeContents(catalog, 'c', rand)!]! += 1;
    expect(counts.a!).toBeGreaterThan(counts.b!);
    expect(counts.b!).toBeGreaterThan(counts.c! - 600);
    expect(counts.c!).toBeGreaterThan(450);
    expect(counts.c!).toBeLessThan(1000);
    expect(drawEnvelopeContents([], null)).toBeNull();
    expect(drawEnvelopeContents(catalog, 'not-in-catalog', () => 0)).toBe('a');
  });

  it('measures near-duplicate photos by hash distance', () => {
    expect(hashDistance(0n, 0n)).toBe(0);
    expect(hashDistance(0b1011n, 0b0001n)).toBe(2);
    expect(hashDistance(-1n, 0n)).toBe(64);
  });
});
