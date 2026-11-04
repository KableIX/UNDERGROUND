-- Silicon Valley DEVELOPMENT district — Santa Clara test routes.
-- Not production-capturable. Monterey remains a separate production-candidate (draft).

BEGIN;

INSERT INTO public.districts (slug, name, region)
VALUES ('silicon-valley-dev', 'Silicon Valley Development', 'California')
ON CONFLICT (slug) DO NOTHING;

-- kind column added in migration 000006; seed geometries are DEV placeholders.
INSERT INTO public.territory_definitions (
  id, slug, name, district_slug, version, status, eligible_weight, geometry, geometry_label
) VALUES
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  'santa-clara-el-camino',
  'Santa Clara El Camino Test',
  'silicon-valley-dev',
  1,
  'draft',
  10,
  ST_GeogFromText('LINESTRING(-121.96 37.35, -121.94 37.35, -121.92 37.352)'),
  'DEV_ONLY_PLACEHOLDER_LINESTRING'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  'santa-clara-central-expressway',
  'Santa Clara Central Expressway Test',
  'silicon-valley-dev',
  1,
  'draft',
  10,
  ST_GeogFromText('LINESTRING(-121.98 37.38, -121.95 37.38, -121.92 37.385)'),
  'DEV_ONLY_PLACEHOLDER_LINESTRING'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
  'santa-clara-lawrence-loop',
  'Lawrence Expressway Loop Test',
  'silicon-valley-dev',
  1,
  'draft',
  8,
  ST_GeogFromText('LINESTRING(-121.995 37.37, -121.995 37.39, -121.99 37.4)'),
  'DEV_ONLY_PLACEHOLDER_LINESTRING'
)
ON CONFLICT (slug, version) DO NOTHING;

COMMIT;
