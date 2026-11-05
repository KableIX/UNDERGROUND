-- Silicon Valley DEVELOPMENT district — Santa Clara / NVIDIA-area draft corridors.
-- NOT road-snapped production geometry. Never production-capturable.
-- Monterey remains a separate production-candidate (draft).

BEGIN;

INSERT INTO public.districts (slug, name, region)
VALUES ('silicon-valley-dev', 'Silicon Valley Development', 'California')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.territory_definitions (
  id, slug, name, district_slug, version, status, eligible_weight, geometry, geometry_label
) VALUES
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
  'santa-clara-el-camino',
  'El Camino — Santa Clara',
  'silicon-valley-dev',
  2,
  'draft',
  10,
  ST_GeogFromText('LINESTRING(-121.99 37.352, -121.975 37.3525, -121.96 37.353, -121.945 37.352, -121.93 37.351)'),
  'UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
  'santa-clara-central-expressway',
  'Central Expressway — NVIDIA corridor',
  'silicon-valley-dev',
  2,
  'draft',
  12,
  ST_GeogFromText('LINESTRING(-121.995 37.378, -121.98 37.375, -121.9677 37.3706, -121.95 37.368, -121.935 37.366)'),
  'UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03',
  'santa-clara-lawrence-loop',
  'Lawrence Expressway loop',
  'silicon-valley-dev',
  2,
  'draft',
  8,
  ST_GeogFromText('LINESTRING(-121.996 37.36, -121.996 37.375, -121.995 37.39, -121.985 37.4, -121.975 37.403)'),
  'UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04',
  'san-tomas-expressway',
  'San Tomas Expressway',
  'silicon-valley-dev',
  2,
  'draft',
  9,
  ST_GeogFromText('LINESTRING(-121.968 37.35, -121.9677 37.36, -121.9677 37.3706, -121.9685 37.385, -121.97 37.4)'),
  'UNVERIFIED_DRAFT_CORRIDOR_NOT_ROAD_SNAPPED'
)
ON CONFLICT (slug, version) DO NOTHING;

COMMIT;
