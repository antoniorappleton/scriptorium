-- Adiciona o bloco horário (tempo letivo) em que a ocorrência aconteceu.
-- Os blocos seguem o horário escolar, com o primeiro tempo a começar às
-- 8h25 (ex: horário do prof. Appleton, ano letivo 2026/2027):
-- 08:25-09:10, 09:15-10:00, 10:20-11:05, 11:10-11:55, 12:05-13:05,
-- 14:10-14:55, 15:00-15:45.

BEGIN;

ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS bloco_horario text;

COMMIT;
