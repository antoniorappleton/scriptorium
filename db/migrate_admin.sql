-- Migration: create ciclos, turmas, turma_professores and extend alunos/professores
BEGIN;

-- ciclos
CREATE TABLE IF NOT EXISTS public.ciclos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL
);

-- turmas
CREATE TABLE IF NOT EXISTS public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ano int,
  ciclo_id uuid REFERENCES public.ciclos(id) ON DELETE SET NULL
);

-- turma_professores (assign roles like DT)
CREATE TABLE IF NOT EXISTS public.turma_professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  professor_id uuid REFERENCES public.professores(id) ON DELETE CASCADE,
  papel text
);

-- extend professores
ALTER TABLE IF EXISTS public.professores
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS criado_em timestamptz DEFAULT now();

-- extend alunos
ALTER TABLE IF EXISTS public.alunos
  ADD COLUMN IF NOT EXISTS ciclo_id uuid REFERENCES public.ciclos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS criado_em timestamptz DEFAULT now();

COMMIT;
