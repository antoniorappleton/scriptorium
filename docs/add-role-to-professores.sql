-- Ensure `role` column exists on `professores` and set initial roles
-- Run this in Supabase SQL Editor before applying RLS policies if you get "column p.role does not exist" error

BEGIN;

ALTER TABLE IF EXISTS public.professores
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- Set the admin account
UPDATE public.professores
  SET role = 'admin'
  WHERE email = 'antonio.appleton@colegio-ramalhao.com';

-- Ensure scriptorium account is a normal user
UPDATE public.professores
  SET role = 'user'
  WHERE email = 'scriptorium@colegio-ramalhao.com';

COMMIT;

-- After running, re-run docs/rls-policies.sql (or the RLS script) in the SQL Editor.
