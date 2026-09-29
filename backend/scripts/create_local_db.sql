-- One-time local development setup. Run as the postgres superuser:
--   psql -h localhost -U postgres -f backend/scripts/create_local_db.sql
-- Safe to re-run. The password below is for LOCAL DEVELOPMENT ONLY.

SELECT 'CREATE ROLE shop LOGIN CREATEDB PASSWORD ''shop'''
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'shop')\gexec

SELECT 'CREATE DATABASE shop OWNER shop'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'shop')\gexec

SELECT 'CREATE DATABASE shop_test OWNER shop'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'shop_test')\gexec
