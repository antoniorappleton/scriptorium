-- RLS policies for Scriptorium
-- Run this in the Supabase SQL Editor (project scope: public schema)
-- This script:
-- 1) enables RLS on key tables
-- 2) creates a helper to read the JWT email claim
-- 3) creates policies:
--    - public SELECT on `ocorrencias` (readable by anyone)
--    - INSERT on `ocorrencias` allowed only if the user's email exists in `professores`
--    - full management (ALL) on `alunos` and `professores` only for `admin` role

-- NOTE: Review table/column names to match your schema before running.

-- 0) Safety: wrap in a transaction
BEGIN;

-- 1) Enable row level security
ALTER TABLE IF EXISTS public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.professores ENABLE ROW LEVEL SECURITY;

-- 2) Helper to extract email from JWT claims supplied by Supabase
-- Supabase exposes JWT claims via the GUC 'request.jwt.claims'
CREATE OR REPLACE FUNCTION public.current_user_email()
  RETURNS text
  LANGUAGE sql STABLE
  AS $$
    SELECT current_setting('request.jwt.claims', true)::json ->> 'email'
  $$;

-- 3) Policies

-- Allow public read for ocorrencias (anyone, including anon)
DROP POLICY IF EXISTS public_select_ocorrencias ON public.ocorrencias;
CREATE POLICY public_select_ocorrencias
  ON public.ocorrencias FOR SELECT
  USING (true);

-- Allow authenticated professors (present in professores table) to insert ocorrencias
DROP POLICY IF EXISTS authenticated_insert_ocorrencias ON public.ocorrencias;
CREATE POLICY authenticated_insert_ocorrencias
  ON public.ocorrencias FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.professores p WHERE p.email = public.current_user_email()
    )
  );

-- Allow authenticated professors (present in professores table) to delete ocorrencias
DROP POLICY IF EXISTS authenticated_delete_ocorrencias ON public.ocorrencias;
CREATE POLICY authenticated_delete_ocorrencias
  ON public.ocorrencias FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.professores p WHERE p.email = public.current_user_email()
    )
  );

-- Allow admins to manage alunos
DROP POLICY IF EXISTS admins_manage_alunos ON public.alunos;
CREATE POLICY admins_manage_alunos
  ON public.alunos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.professores p WHERE p.email = public.current_user_email() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.professores p WHERE p.email = public.current_user_email() AND p.role = 'admin'
    )
  );

-- Allow admins to manage professores (so you can create/assign other professors)
DROP POLICY IF EXISTS admins_manage_professores ON public.professores;
CREATE POLICY admins_manage_professores
  ON public.professores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.professores p WHERE p.email = public.current_user_email() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.professores p WHERE p.email = public.current_user_email() AND p.role = 'admin'
    )
  );

COMMIT;

-- After running: verify policies in the Supabase Dashboard → Authentication & Policies
-- Important: test with a non-admin account and with an admin account to ensure policies behave as expected.
