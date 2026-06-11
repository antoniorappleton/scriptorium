-- Permite que utilizadores com role='admin' em public.professores
-- possam gerir alunos, turmas, ciclos e ligações turma/professor.
--
-- Execute este ficheiro no SQL Editor do Supabase.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_email()
  RETURNS text
  LANGUAGE sql
  STABLE
  AS $$
    SELECT COALESCE(
      auth.jwt() ->> 'email',
      current_setting('request.jwt.claims', true)::json ->> 'email'
    )
  $$;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1
      FROM public.professores p
      WHERE lower(p.email) = lower(public.current_user_email())
        AND p.role = 'admin'
    )
  $$;

ALTER TABLE IF EXISTS public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ciclos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.turma_professores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_manage_alunos ON public.alunos;
CREATE POLICY admins_manage_alunos
  ON public.alunos FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS authenticated_select_alunos ON public.alunos;
CREATE POLICY authenticated_select_alunos
  ON public.alunos FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS admins_manage_turmas ON public.turmas;
CREATE POLICY admins_manage_turmas
  ON public.turmas FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS authenticated_select_turmas ON public.turmas;
CREATE POLICY authenticated_select_turmas
  ON public.turmas FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS admins_manage_ciclos ON public.ciclos;
CREATE POLICY admins_manage_ciclos
  ON public.ciclos FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

DROP POLICY IF EXISTS authenticated_select_ciclos ON public.ciclos;
CREATE POLICY authenticated_select_ciclos
  ON public.ciclos FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS admins_manage_turma_professores ON public.turma_professores;
CREATE POLICY admins_manage_turma_professores
  ON public.turma_professores FOR ALL
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

COMMIT;
