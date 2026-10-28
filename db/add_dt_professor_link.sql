-- Liga cada turma ao registo do professor que é o seu Diretor de Turma
-- (até agora `turmas.diretor_turma` era só texto livre, sem FK), para se
-- poder obter um email inequívoco do DT a quem enviar relatórios.
--
-- Pré-requisito: db/add_diretor_turma.sql já deve ter sido executado
-- (cria e popula `turmas.diretor_turma`).
-- Execute este ficheiro no SQL Editor do Supabase.

BEGIN;

CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE IF EXISTS public.turmas
  ADD COLUMN IF NOT EXISTS dt_professor_id uuid REFERENCES public.professores(id) ON DELETE SET NULL;

-- Faz o match por nome normalizado (sem acentos, sem maiúsculas) entre
-- turmas.diretor_turma e professores.nome. Só atualiza linhas que ainda
-- não têm dt_professor_id e cujo nome tem exatamente um professor
-- correspondente (evita ligações ambíguas).
UPDATE public.turmas t
SET dt_professor_id = p.id
FROM public.professores p
WHERE t.dt_professor_id IS NULL
  AND t.diretor_turma IS NOT NULL
  AND lower(unaccent(p.nome)) = lower(unaccent(t.diretor_turma))
  AND (
    SELECT count(*) FROM public.professores p2
    WHERE lower(unaccent(p2.nome)) = lower(unaccent(t.diretor_turma))
  ) = 1;

COMMIT;

-- Verificação pós-execução: turmas com DT definido mas ainda sem professor
-- ligado (nome não corresponde a nenhum professor, ou corresponde a mais
-- de um). Corrigir manualmente com:
--   UPDATE turmas SET dt_professor_id = '<uuid-do-professor>' WHERE id = '<uuid-da-turma>';
SELECT id, nome, ano, diretor_turma
FROM public.turmas
WHERE diretor_turma IS NOT NULL
  AND dt_professor_id IS NULL;
