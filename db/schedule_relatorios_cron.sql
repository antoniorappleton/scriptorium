-- Agenda os relatórios automáticos semanal e mensal, chamando a Edge
-- Function `send-relatorios-dt` via pg_cron + pg_net (padrão recomendado
-- pela Supabase para agendar Edge Functions).
--
-- IMPORTANTE antes de executar:
-- 1. A Edge Function já deve estar deployada (`supabase functions deploy
--    send-relatorios-dt --no-verify-jwt`).
-- 2. O secret CRON_SECRET já deve estar definido na function
--    (`supabase secrets set CRON_SECRET=...`).
-- 3. Substitua abaixo <CRON_SECRET> pelo MESMO valor usado nesse secret.
-- 4. Teste primeiro manualmente com `dryRun=true` (ver README) antes de
--    correr este ficheiro — ele ativa o envio automático real.
--
-- Nota: pg_cron corre sempre em UTC, sem ajuste de horário de verão.
-- 07:00 UTC = 07:00 em Lisboa no inverno, 08:00 no verão.
--
-- Execute este ficheiro no SQL Editor do Supabase.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'relatorios-semanais',
  '0 7 * * 1',
  $$
  select net.http_post(
    url := 'https://pllmyptwuvxryxfeufcm.supabase.co/functions/v1/send-relatorios-dt?period=weekly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>')
  );
  $$
);

select cron.schedule(
  'relatorios-mensais',
  '0 7 1 * *',
  $$
  select net.http_post(
    url := 'https://pllmyptwuvxryxfeufcm.supabase.co/functions/v1/send-relatorios-dt?period=monthly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>')
  );
  $$
);

-- Para verificar os jobs agendados:
-- SELECT * FROM cron.job;
-- Para remover um job (ex. para reconfigurar):
-- SELECT cron.unschedule('relatorios-semanais');
-- SELECT cron.unschedule('relatorios-mensais');
