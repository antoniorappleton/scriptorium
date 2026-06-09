-- Correções para os advisors de segurança do Supabase anexados.
-- Executar no Supabase SQL Editor.

BEGIN;

-- 1) Function Search Path Mutable
-- Estas funções aparecem no advisor como sem search_path fixo.
-- Se alguma não existir no ambiente, comente essa linha e execute novamente.
ALTER FUNCTION IF EXISTS public.jwt_claims() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.jwt_email() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.jwt_sub() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION IF EXISTS public.current_user_email() SET search_path = public, pg_temp;

-- 2) RLS Policy Always True: alunos/auth_insert_alunos
-- Substitui WITH CHECK (true) por validação de professor autenticado.
DROP POLICY IF EXISTS auth_insert_alunos ON public.alunos;
CREATE POLICY auth_insert_alunos
  ON public.alunos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professores p
      WHERE p.email = public.current_user_email()
    )
  );

-- 3) RLS Policy Always True: ocorrencias/auth_insert_ocorrencias
-- Substitui WITH CHECK (true) por validação de professor autenticado.
DROP POLICY IF EXISTS auth_insert_ocorrencias ON public.ocorrencias;
CREATE POLICY auth_insert_ocorrencias
  ON public.ocorrencias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.professores p
      WHERE p.email = public.current_user_email()
    )
  );

-- 4) Permissão necessária para o botão "Eliminar ocorrência".
DROP POLICY IF EXISTS authenticated_delete_ocorrencias ON public.ocorrencias;
CREATE POLICY authenticated_delete_ocorrencias
  ON public.ocorrencias FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.professores p
      WHERE p.email = public.current_user_email()
    )
  );

COMMIT;

-- Advisor "Leaked Password Protection Disabled":
-- Não é corrigido por SQL. Ativar em Supabase Dashboard:
-- Authentication > Providers/Settings > Password security > Leaked password protection.
