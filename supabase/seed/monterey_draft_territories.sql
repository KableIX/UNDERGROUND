-- DRAFT Monterey territories — placeholder LineStrings only.
-- Do not promote to approved without reviewed road-following geometry.

BEGIN;

INSERT INTO public.districts (slug, name, region)
VALUES ('monterey', 'Monterey District', 'California')
ON CONFLICT (slug) DO NOTHING;

-- Coordinates are coarse placeholders labeled DRAFT.
INSERT INTO public.territory_definitions (
  id, slug, name, district_slug, version, status, eligible_weight, geometry, geometry_label
) VALUES
(
  '11111111-1111-4111-8111-111111111101',
  'highway-1-big-sur',
  'Highway 1 / Big Sur',
  'monterey',
  1,
  'draft',
  20,
  ST_GeogFromText('LINESTRING(-121.95 36.55, -121.9 36.4, -121.8 36.25)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
),
(
  '11111111-1111-4111-8111-111111111102',
  'carmel-valley-road',
  'Carmel Valley Road',
  'monterey',
  1,
  'draft',
  14,
  ST_GeogFromText('LINESTRING(-121.92 36.5, -121.75 36.48, -121.6 36.47)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
),
(
  '11111111-1111-4111-8111-111111111103',
  'laureles-grade',
  'Laureles Grade',
  'monterey',
  1,
  'draft',
  12,
  ST_GeogFromText('LINESTRING(-121.78 36.55, -121.72 36.52, -121.68 36.48)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
),
(
  '11111111-1111-4111-8111-111111111104',
  'seventeen-mile-drive',
  '17-Mile Drive',
  'monterey',
  1,
  'draft',
  16,
  ST_GeogFromText('LINESTRING(-121.95 36.6, -121.97 36.57, -121.95 36.54)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
),
(
  '11111111-1111-4111-8111-111111111105',
  'pacific-grove',
  'Pacific Grove',
  'monterey',
  1,
  'draft',
  10,
  ST_GeogFromText('LINESTRING(-121.92 36.62, -121.91 36.62, -121.9 36.61)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
),
(
  '11111111-1111-4111-8111-111111111106',
  'cannery-row',
  'Cannery Row',
  'monterey',
  1,
  'draft',
  8,
  ST_GeogFromText('LINESTRING(-121.9 36.615, -121.895 36.616, -121.89 36.617)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
),
(
  '11111111-1111-4111-8111-111111111107',
  'laguna-seca-area',
  'Laguna Seca Area',
  'monterey',
  1,
  'draft',
  20,
  ST_GeogFromText('LINESTRING(-121.75 36.58, -121.75 36.584, -121.753 36.586, -121.755 36.582)'),
  'DRAFT_PLACEHOLDER_LINESTRING'
)
ON CONFLICT (slug, version) DO NOTHING;

COMMIT;
