-- Enable PostGIS for territory geometries.
-- Apply only against a real Supabase/Postgres project; no credentials in-repo.

CREATE EXTENSION IF NOT EXISTS postgis;
