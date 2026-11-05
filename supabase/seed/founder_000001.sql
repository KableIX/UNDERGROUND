-- Audited founder provisioning seed (dry-run friendly).
-- Replace :auth_user_id with the real Supabase auth user UUID before applying.
-- Founder is NOT admin — role stays 'member'.

BEGIN;

INSERT INTO public.districts (slug, name, region)
VALUES ('monterey', 'Monterey District', 'California')
ON CONFLICT (slug) DO NOTHING;

-- Operator must bind a real auth user. This statement fails closed without a param.
-- Example: \set auth_user_id '00000000-0000-4000-8000-000000000001'

INSERT INTO public.members (auth_user_id, member_number, display_name, is_founder, role)
VALUES (
  :'auth_user_id'::uuid,
  '000001',
  'STARK',
  TRUE,
  'member'
)
ON CONFLICT (member_number) DO UPDATE
SET
  auth_user_id = EXCLUDED.auth_user_id,
  display_name = 'STARK',
  is_founder = TRUE
  -- role intentionally not escalated to admin
RETURNING id;

-- Profile + Top 8 empty
INSERT INTO public.profiles (member_id, bio, top_eight)
SELECT m.id, 'Founder. Ownership is the entry.', '{}'
FROM public.members m
WHERE m.member_number = '000001'
ON CONFLICT (member_id) DO UPDATE
SET bio = EXCLUDED.bio, updated_at = now();

-- Founder garage: 2010 Audi R8 V10 (friend-only)
WITH founder AS (
  SELECT id FROM public.members WHERE member_number = '000001'
),
vehicle AS (
  INSERT INTO public.vehicles (
    owner_member_id, year, make, model, trim, color, transmission, wheels, brakes,
    verification_status, visibility
  )
  SELECT
    founder.id, 2010, 'Audi', 'R8', 'V10 5.2 Quattro', 'black', 'R-Tronic',
    'Vossen HF-5', 'red ceramics', 'verified', 'friends'
  FROM founder
  RETURNING id
)
INSERT INTO public.vehicle_mods (vehicle_id, title, description, status, installed_at)
SELECT vehicle.id, x.title, x.description, x.status::public.mod_status, x.installed_at
FROM vehicle
CROSS JOIN (
  VALUES
    ('Vossen HF-5 wheels', 'Installed wheel set', 'installed', now()),
    ('Red ceramic brakes', 'Red-finished ceramics', 'installed', now()),
    ('Exhaust tune (pending)', 'Awaiting install', 'pending', NULL)
) AS x(title, description, status, installed_at);

WITH vehicle AS (
  SELECT v.id
  FROM public.vehicles v
  JOIN public.members m ON m.id = v.owner_member_id
  WHERE m.member_number = '000001'
  ORDER BY v.created_at ASC
  LIMIT 1
)
INSERT INTO public.vehicle_media (vehicle_id, storage_path, is_placeholder, caption, sort_order)
SELECT vehicle.id, x.path, TRUE, x.caption, x.sort_order
FROM vehicle
CROSS JOIN (
  VALUES
    ('placeholders/garage/r8-front.PLACEHOLDER.jpg', 'PLACEHOLDER — licensed R8 photography needed', 0),
    ('placeholders/garage/r8-rear.PLACEHOLDER.jpg', 'PLACEHOLDER — licensed R8 photography needed', 1)
) AS x(path, caption, sort_order);

COMMIT;
