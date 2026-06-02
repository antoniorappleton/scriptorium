-- Schema para Scriptorium (Supabase / PostgreSQL)

-- Tabela alunos
CREATE TABLE IF NOT EXISTS alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ano int,
  turma text
);

-- Tabela professores
CREATE TABLE IF NOT EXISTS professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text UNIQUE
);

-- Tabela ocorrencias
CREATE TABLE IF NOT EXISTS ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid REFERENCES alunos(id) ON DELETE SET NULL,
  professor_id uuid REFERENCES professores(id) ON DELETE SET NULL,
  aluno_nome text,
  ano int,
  turma text,
  data date,
  motivo text,
  created_at timestamp with time zone DEFAULT now()
);
