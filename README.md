# Scriptorium — PWA de Registo de Ocorrências

Scaffold da PWA Scriptorium. Todos os ficheiros da aplicação encontram-se na pasta `/app`.

A aplicação foi desenvolvida com um design system moderno em **Vanilla CSS** que funciona de forma **100% offline**, removendo quaisquer dependências de CDNs externas de CSS (como o Tailwind).

---

## Funcionalidades da Aplicação

### 1. Registo de Ocorrências
- Formulário intuitivo para registar incidentes e acontecimentos escolares.
- Associação a dados chave: Nome do Aluno, Ano Escolar, Turma, Data da Ocorrência e Descrição detalhada do sucedido.

### 2. Dashboard de Estatísticas (Visão Geral)
- **Métricas em Tempo Real:** Apresentação de estatísticas rápidas que mostram a quantidade de ocorrências registadas *Hoje*, *Este Mês*, *Este Ano* e a contagem total de *Alunos Únicos* envolvidos.
- **Gráfico SVG Dinâmico:** Gráfico semanal desenhado dinamicamente no cliente com SVG que exibe a distribuição de ocorrências nos últimos 7 dias.
- **Pesquisa e Filtragem:** Campo de pesquisa instantâneo que permite pesquisar e filtrar o histórico de ocorrências por nome de aluno em tempo real.

### 3. Progressive Web App (PWA) & Modo Offline
- **Execução Offline:** Instalação como aplicação de desktop ou telemóvel com suporte a precache de todas as páginas, ficheiros, fontes e bibliotecas do Supabase no browser via Service Worker.
- **Registo Local Resiliente:** Se a rede falhar ao registar uma ocorrência, os dados são guardados de forma segura no `localStorage` sob o estado de **Pendente**.
- **Sincronização Inteligente:** Ao restabelecer a ligação, a aplicação exibe um botão interativo e pulsante **"Sincronizar Pendentes"** para submeter os registos locais para a base de dados do Supabase.

### 4. Painel de Administração e Gestão
- **Acesso Restrito por Função:** Verificação automática de autenticação e papel (`role === 'admin'`) na tabela de professores. Utilizadores sem permissões administrativas são impedidos de aceder às configurações e são redirecionados automaticamente.
- **Gestão de Alunos (Rápida):** Atalho lateral no dashboard para adicionar novos alunos de forma célere.
- **Gestão de Turmas e Ciclos:** Painel completo para criar ciclos de ensino (ex. 3º Ciclo, Secundário) e turmas associadas, especificando o ano letivo.
- **Importação em Massa via CSV:** Integração com a biblioteca *PapaParse* para importação e leitura de listas de alunos a partir de ficheiros CSV, com inserção otimizada em base de dados em lotes (*batches* de 100).

### 5. Autenticação e Segurança
- Autenticação de utilizadores gerida pelo **Supabase Auth**.
- Segurança de dados robusta utilizando **Row Level Security (RLS)** na base de dados do Supabase.

---

## Passos para usar:

1. **Configurar Supabase:** Criar um projeto no Supabase e configurar as tabelas `alunos`, `professores`, `ocorrencias`, `ciclos` e `turmas` (ver ficheiros em `/db`).
2. **Atualizar credenciais:** Atualizar o ficheiro `app/js/supabase.js` com a `SUPABASE_URL` e a `SUPABASE_KEY` (utilizar apenas a chave pública `anon`).
3. **Servir localmente:** Servir a pasta `app` (ex: `npx http-server ./app -p 8080` ou usar VS Code Live Server).
4. **Testar login:** Autenticar com o utilizador do Supabase (Magic Link ou password).

---

## Deploy & Verificação (GitHub Pages)

- O workflow `.github/workflows/deploy-pages.yml` publica a pasta `app/` para a branch `gh-pages` automaticamente ao efetuar push para a branch `main`.
- URL da aplicação publicada: `https://antoniorappleton.github.io/scriptorium/`

### Verificações rápidas pós-deploy:

- Verificar que a página principal responde com sucesso (200):
  ```bash
  curl -I -L https://antoniorappleton.github.io/scriptorium/ | head -n 1
  ```

- Verificar que a página de login está acessível:
  ```bash
  curl -sSf https://antoniorappleton.github.io/scriptorium/login.html >/dev/null && echo "login OK" || echo "login NOK"
  ```

- Verificar que os assets essenciais são carregados corretamente:
  ```bash
  curl -I https://antoniorappleton.github.io/scriptorium/css/styles.css
  curl -I https://antoniorappleton.github.io/scriptorium/js/supabase.js
  ```

---

## Estrutura do Repositório

- `app/` — Código fonte completo da aplicação PWA (HTML, CSS, JS, Assets).
- `db/` — Scripts SQL para criação das tabelas e migrações do banco de dados no Supabase.
- `docs/` — Documentação complementar (desenvolvimento local, etc.).
- `docs_backup/` — Instruções originais de configuração e suporte.

Scriptorium/ (Raiz)
├── .github/workflows/deploy-pages.yml  --> Configurado para publicar a pasta ./app
├── app/                                --> A APLICAÇÃO ATUALIZADA (UI/UX Premium & Offline)
│   ├── assets/ (Imagens e Logos)
│   ├── css/styles.css                  --> Novo Design System nativo (Vanilla CSS)
│   ├── js/ (app.js, admin.js, supabase.js)
│   ├── index.html, login.html, registar.html, admin.html
│   ├── manifest.json
│   └── service-worker.js
├── db/                                 --> Scripts SQL de tabelas e migrações
├── docs/LOCAL_DEV.md                   --> Atualizado para apontar para a pasta /app
├── index.html                          --> Redirecionamento para /app
└── README.md                           --> Atualizado com as funcionalidades da aplicação