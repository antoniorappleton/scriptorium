-- Preenche diretor_turma em ocorrências já existentes, usando o ano/turma
-- já gravado em cada ocorrência para encontrar o DT correspondente em `turmas`.
-- Pré-requisito: correr primeiro db/add_diretor_turma.sql (cria a coluna e
-- popula turmas.diretor_turma).
-- Idempotente e seguro: só atualiza linhas que ainda não têm DT preenchido,
-- e usa subquery correlacionada (não JOIN) para nunca duplicar/ambiguar linhas
-- mesmo que exista mais que uma turma com o mesmo nome em anos diferentes.

BEGIN;

UPDATE ocorrencias o
SET diretor_turma = (
  SELECT t.diretor_turma
  FROM turmas t
  WHERE t.ano = o.ano
    AND t.nome = o.turma
    AND t.diretor_turma IS NOT NULL
  LIMIT 1
)
WHERE o.diretor_turma IS NULL
  AND o.ano IS NOT NULL
  AND o.turma IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM turmas t
    WHERE t.ano = o.ano AND t.nome = o.turma AND t.diretor_turma IS NOT NULL
  );

COMMIT;

-- Verificação pós-execução (opcional, corre à parte):
-- SELECT count(*) FILTER (WHERE diretor_turma IS NOT NULL) AS com_dt,
--        count(*) FILTER (WHERE diretor_turma IS NULL) AS sem_dt
-- FROM ocorrencias;
