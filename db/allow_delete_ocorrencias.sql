-- Permite eliminar ocorrências a utilizadores autenticados registados
-- na tabela public.professores.
--
-- Necessário para:
-- - eliminar ocorrências individuais na dashboard;
-- - eliminar ocorrências por período no painel admin.
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

CREATE OR REPLACE FUNCTION public.is_current_user_professor()
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
    )
  $$;

CREATE OR REPLACE FUNCTION public.delete_ocorrencia_by_id(occurrence_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    deleted_count integer;
  BEGIN
    IF NOT public.is_current_user_professor() THEN
      RAISE EXCEPTION 'Sem permissão para eliminar ocorrências.';
    END IF;

    DELETE FROM public.ocorrencias
    WHERE id = occurrence_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
  END;
  $$;

CREATE OR REPLACE FUNCTION public.delete_ocorrencias_between(start_date date, end_date date)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  DECLARE
    deleted_count integer;
  BEGIN
    IF NOT public.is_current_user_professor() THEN
      RAISE EXCEPTION 'Sem permissão para eliminar ocorrências.';
    END IF;

    DELETE FROM public.ocorrencias
    WHERE data >= start_date
      AND data <= end_date;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
  END;
  $$;

ALTER TABLE IF EXISTS public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_delete_ocorrencias ON public.ocorrencias;
CREATE POLICY authenticated_delete_ocorrencias
  ON public.ocorrencias FOR DELETE
  TO authenticated
  USING (public.is_current_user_professor());

GRANT EXECUTE ON FUNCTION public.delete_ocorrencia_by_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ocorrencias_between(date, date) TO authenticated;

COMMIT;
