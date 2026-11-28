import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supercargoSeedCatalog } from '@underground/domain';
import { carArtIds } from './art-ids';

const dir = join(__dirname, '../../assets/supercargo/cars');

describe('SupercarGO Ledger artwork', () => {
  it('has one id per catalog car', () => {
    expect([...carArtIds].sort()).toEqual(supercargoSeedCatalog.map((c) => c.id).sort());
  });

  it('bundles a render and a silhouette for every car, each a small WebP', () => {
    for (const id of carArtIds) {
      for (const file of [`${id}.webp`, `${id}.silhouette.webp`]) {
        const path = join(dir, file);
        expect(existsSync(path), file).toBe(true);
        expect(statSync(path).size, file).toBeLessThan(120_000);
        expect(readFileSync(path).subarray(8, 12).toString('latin1'), file).toBe('WEBP');
      }
    }
  });

  it('wires every id into the require map', () => {
    const source = readFileSync(join(__dirname, 'art.ts'), 'utf8');
    for (const id of carArtIds) expect(source).toContain(`cars/${id}.webp`);
  });
});
