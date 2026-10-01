-- Permite editar ocorrências (data, bloco_horario, motivo) a utilizadores
-- autenticados registados na tabela public.professores — mesmo critério já
-- usado para eliminar ocorrências.
--
-- Pré-requisito: correr primeiro db/allow_delete_ocorrencias.sql (cria a
-- função public.is_current_user_professor() reutilizada aqui).
--
-- Necessário para o popup de edição em "Ocorrências Recentes" (dashboard).
-- Execute este ficheiro no SQL Editor do Supabase.

BEGIN;

ALTER TABLE IF EXISTS public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_update_ocorrencias ON public.ocorrencias;
CREATE POLICY authenticated_update_ocorrencias
  ON public.ocorrencias FOR UPDATE
  TO authenticated
  USING (public.is_current_user_professor())
  WITH CHECK (public.is_current_user_professor());

COMMIT;
