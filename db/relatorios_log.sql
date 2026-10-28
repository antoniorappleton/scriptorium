-- Registo de auditoria dos relatórios automáticos enviados por email aos
-- Diretores de Turma (semanal/mensal), já que correm sem supervisão direta
-- via cron. Permite confirmar o que foi (ou não) enviado e porquê.
--
-- Pré-requisito: db/admin_manage_alunos_turmas.sql já deve ter sido
-- executado (define public.is_current_user_admin()).
-- Execute este ficheiro no SQL Editor do Supabase.

BEGIN;

CREATE TABLE IF NOT EXISTS public.relatorios_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo text NOT NULL,
  turma text NOT NULL,
  ano int,
  professor_email text,
  data_inicio date,
  data_fim date,
  ocorrencias_count int,
  status text NOT NULL,
  erro text,
  criado_em timestamptz DEFAULT now()
);

ALTER TABLE public.relatorios_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admins_select_relatorios_log ON public.relatorios_log;
CREATE POLICY admins_select_relatorios_log
  ON public.relatorios_log FOR SELECT
  USING (public.is_current_user_admin());

COMMIT;
