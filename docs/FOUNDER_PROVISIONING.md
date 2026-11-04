# Founder provisioning (member 000001 / STARK)

## Rules

- Founder identity ≠ admin permissions (`is_founder=true`, `role=member`).
- Provisioning is audited and operator-driven — never auto-admin by username.
- Dry-run by default until Supabase service role + operator token exist.

## Paths

1. **SQL seed:** `supabase/seed/founder_000001.sql`  
   Bind `:auth_user_id` to a real Supabase Auth user, then apply in a reviewed session.
2. **API plan:** `services/api` → `planFounderProvision`  
   Returns a dry-run plan (`mode: 'dry_run'`) until credentials allow persist.
3. **Garage seed:** 2010 Audi R8 V10 (black, R-Tronic, Vossen HF-5, red ceramics), friend-only visibility, placeholder media marked `is_placeholder=true`, installed vs pending mods.

## Blocked without credentials

- Persisting member/profile/vehicle rows
- Private storage upload of garage originals
- Real friendship graph against live auth users
