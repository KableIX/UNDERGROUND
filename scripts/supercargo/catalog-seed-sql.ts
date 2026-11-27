// Generates the SupercarGO catalog seed migration from the domain seed list.
// Run: pnpm --filter @underground/domain exec tsx ../../scripts/supercargo/catalog-seed-sql.ts > supabase/seed/supercargo_catalog.sql
import { catalogEntryProblems, computeRarity } from '../../packages/domain/src/supercargo';
import { supercargoSeedCatalog } from '../../packages/domain/src/supercargo-catalog';

const AS_OF_YEAR = 2026;
const q = (v: string | null | undefined) => (v === null || v === undefined ? 'NULL' : "'" + v.replace(/'/g, "''") + "'");
const ids = new Set<string>();
const rows = supercargoSeedCatalog.map((e) => {
  const problems = catalogEntryProblems(e);
  if (problems.length) throw new Error(`${e.id}: ${problems.join(', ')}`);
  if (ids.has(e.id)) throw new Error(`duplicate id ${e.id}`);
  ids.add(e.id);
  const r = computeRarity({ built: e.built, firstYear: e.firstYear, asOfYear: AS_OF_YEAR });
  return `  (${q(e.id)}, ${q(e.make)}, ${q(e.model)}, ${q(e.variant ?? null)}, ${e.built ?? 'NULL'}, ${q(e.builtSource)}, ${e.firstYear ?? 'NULL'}, '${r.tier}', ${r.score})`;
});

console.log(`-- SupercarGO catalog seed. GENERATED from packages/domain/src/supercargo-catalog.ts
-- by scripts/supercargo/catalog-seed-sql.ts (rarity as of ${AS_OF_YEAR}). Do not edit by hand.
-- Idempotent: upserts by id and never deletes, so folios that reference a row stay valid.
BEGIN;
INSERT INTO public.supercargo_catalog (id, make, model, variant, built, built_source, first_year, tier, score) VALUES
${rows.join(',\n')}
ON CONFLICT (id) DO UPDATE SET
  make = EXCLUDED.make, model = EXCLUDED.model, variant = EXCLUDED.variant, built = EXCLUDED.built,
  built_source = EXCLUDED.built_source, first_year = EXCLUDED.first_year, tier = EXCLUDED.tier,
  score = EXCLUDED.score, updated_at = now();
COMMIT;`);
