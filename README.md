# Scriptorium — PWA de Registo de Ocorrências

Scaffold inicial da PWA Scriptorium. Coloca os ficheiros em `/app`.

Passos para usar:

1. Criar um projeto no Supabase e configurar tabelas: `alunos`, `professores`, `ocorrencias` conforme especificação.
2. Atualizar `app/js/supabase.js` com `SUPABASE_URL` e `SUPABASE_KEY`.
3. Servir a pasta (ex: `npx http-server .` ou usar um servidor estático). Abrir `app/index.html`.
4. Testar o login em `app/login.html` (Supabase Auth envia Magic Link).

Offline: ocorrências falham para enviar são guardadas em `localStorage` e podem ser sincronizadas com o botão "Sincronizar pendentes".

-- Adições recentes: UI melhorada, placeholder de logo em `/app/assets/logo.svg`, ficheiros de suporte e instruções Supabase em `docs/supabase-setup.md`.

## Deploy & Verificação (checks rápidos)

**Publicação no GitHub Pages**

- O workflow `.github/workflows/deploy-pages.yml` publica a pasta `app/` para a branch `gh-pages` automaticamente quando fizeres push para `main`.
- Para disparar um deploy: commit e push para `main` (ou re-run do Actions se preferires).

**URL esperada (Project Page)**

- https://<usuario>.github.io/<repo>/ — ex: `https://antoniorappleton.github.io/scriptorium/`

**Verificações rápidas pós-deploy (substitui a URL pelo teu repo)**

- Verificar que a página principal responde 200:

```bash
curl -I -L https://antoniorappleton.github.io/scriptorium/ | head -n 1
```

- Verificar que a página de login está acessível:

```bash
curl -sSf https://antoniorappleton.github.io/scriptorium/login.html >/dev/null && echo "login OK" || echo "login NOK"
```

- Verificar assets essenciais (CSS/JS) não retornam 404:

```bash
curl -I https://antoniorappleton.github.io/scriptorium/css/styles.css
curl -I https://antoniorappleton.github.io/scriptorium/js/supabase.js
```

**Teste local rápido (antes de push)**

```bash
# a partir da raiz do repositório
npx http-server ./app -p 8080
# ou
cd app && python -m http.server 8080

# abrir http://localhost:8080/
```

**Teste de login**

- Abrir `app/login.html` localmente ou a URL publicada e tentar autenticar com um utilizador existente no Supabase.
- Se quiseres uma conta de teste, usa os comandos em `docs/create-users.md` para criar `scriptorium@colegio-ramalhao.com`.

**Service worker / PWA**

- Verifica no DevTools → Application → Service Workers que o `service-worker.js` está instalado e activo.
- Forçar reload: abrir DevTools → Application → Service Workers → `Skip waiting` / unregister durante debugging.

**Notas de segurança**

- Nunca comites a `service_role` key do Supabase. Os exemplos abaixo usam *placeholders* que deves substituir localmente.
- No cliente, usa apenas a `anon/public` key.

Para comandos de criação de utilizadores e SQL (ex.: criar `scriptorium@colegio-ramalhao.com`) vê `docs/create-users.md`.

