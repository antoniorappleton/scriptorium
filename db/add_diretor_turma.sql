-- Adiciona Diretor de Turma (DT) às turmas e regista-o automaticamente nas ocorrências.
-- Gerado a partir de 'Dadosalunos5ateliceu(Alunos Ativos 20262027).csv' (30 turmas, DT verificado consistente por turma).
BEGIN;

ALTER TABLE turmas ADD COLUMN IF NOT EXISTS diretor_turma text;
ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS diretor_turma text;

-- Popula o DT de cada turma existente
UPDATE turmas t
SET diretor_turma = v.dt
FROM (VALUES
  ('A', 5, '2º Ciclo', 'Mariana Pereira Alho Da Silva Ramalho Sobral'),
  ('B', 5, '2º Ciclo', 'David Miguel Teixeira De Oliveira'),
  ('C', 5, '2º Ciclo', 'Sara Filipa Infante Gaspar Chambel Leitão'),
  ('A', 6, '2º Ciclo', 'Jorge Manuel Rodrigues Morais Varandas Fernandes'),
  ('B', 6, '2º Ciclo', 'Xavier Calvão Mestre'),
  ('C', 6, '2º Ciclo', 'Margarida Da Silva Marques'),
  ('A', 7, '3º Ciclo', 'Mariana Da Silva Fontes'),
  ('B', 7, '3º Ciclo', 'Fernando Tiago Rosa Franco Frazão Marques Da Silva'),
  ('C', 7, '3º Ciclo', 'Diogo Nuno Martins De Brito Alves Moreira'),
  ('A', 8, '3º Ciclo', 'Ana Rita Zuzarte Reis Gomes Nunes Ribeiro'),
  ('B', 8, '3º Ciclo', 'Maria Da Luz Tinoco Alpoim Barbosa'),
  ('C', 8, '3º Ciclo', 'João Francisco Dos Santos Neto Mariano'),
  ('A', 9, '3º Ciclo', 'Carolina Antunes Borges'),
  ('B', 9, '3º Ciclo', 'João Pedro Marques Sobral'),
  ('A', 10, 'Ciências e Tecnologias', 'Sara Raquel Lopes De Lira'),
  ('B', 10, 'Ciências e Tecnologias', 'Concha Cal Reynolds De Sousa'),
  ('C', 10, 'Ciências e Tecnologias', 'Carlos Manuel Costa Domingos'),
  ('A', 11, 'Ciências e Tecnologias', 'Carla Alexandra dos Reis da Silva Saldanha'),
  ('B', 11, 'Ciências e Tecnologias', 'Inês Ribeiro Garcia De Paiva Couceiro'),
  ('C', 11, 'Ciências e Tecnologias', 'Susana Duarte de Santos Viola'),
  ('A', 12, 'Ciências e Tecnologias', 'Francisco Salgado Machado De Oliveira E Maia'),
  ('B', 12, 'Ciências e Tecnologias', 'Margarida Maria Dias Nobre Bábau'),
  ('A1', 10, 'R25 - Curso de Técnico de Informática Sistemas', 'António Maria Rivotti Maggiorani Appleton'),
  ('B1', 10, 'R25 - Curso de Técnico de Informática Sistemas', 'António Maria Rivotti Maggiorani Appleton'),
  ('C1', 10, 'R25 - Curso de Técnico de Informática Sistemas', 'António Maria Rivotti Maggiorani Appleton'),
  ('A1', 11, 'R25 - Curso de Técnico de Informática Sistemas', 'David Amaro Pereira Teixeira'),
  ('B1', 11, 'R25 - Curso de Técnico de Informática Sistemas', 'David Amaro Pereira Teixeira'),
  ('C1', 11, 'R25 - Curso de Técnico de Informática Sistemas', 'David Amaro Pereira Teixeira'),
  ('A1', 12, 'R25 - Curso de Técnico de Informática Sistemas', 'Sofia Silva Lopes Nogueira Cabral Antunes Oliveira'),
  ('B1', 12, 'R25 - Curso de Técnico de Informática Sistemas', 'Sofia Silva Lopes Nogueira Cabral Antunes Oliveira')
) AS v(turma, ano, ciclo_nome, dt)
JOIN ciclos c ON c.nome = v.ciclo_nome
WHERE t.nome = v.turma AND t.ano = v.ano AND t.ciclo_id = c.id;

COMMIT;
