-- Permite eliminar ocorrências a utilizadores autenticados registados em professores.
-- Necessário para:
-- - eliminar ocorrências individuais na dashboard;
-- - eliminar ocorrências por período no painel admin.

ALTER TABLE IF EXISTS public.ocorrencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS authenticated_delete_ocorrencias ON public.ocorrencias;
CREATE POLICY authenticated_delete_ocorrencias
  ON public.ocorrencias FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.professores p
      WHERE p.email = public.current_user_email()
    )
  );

