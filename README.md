# Scriptorium — PWA de Registo de Ocorrências

Scaffold inicial da PWA Scriptorium. Coloca os ficheiros em `/app`.

Passos para usar:

1. Criar um projeto no Supabase e configurar tabelas: `alunos`, `professores`, `ocorrencias` conforme especificação.
2. Atualizar `app/js/supabase.js` com `SUPABASE_URL` e `SUPABASE_KEY`.
3. Servir a pasta (ex: `npx http-server .` ou usar um servidor estático). Abrir `/app/index.html`.
4. Testar o login em `/app/login.html` (Supabase Auth envia Magic Link).

Offline: ocorrências falham para enviar são guardadas em `localStorage` e podem ser sincronizadas com o botão "Sincronizar pendentes".

-- Adições recentes: UI melhorada, placeholder de logo em `/app/assets/logo.svg`, ficheiros de suporte e instruções Supabase em `docs/supabase-setup.md`.

