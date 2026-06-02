# Criar credenciais (Supabase)

Vou descrever passos para criar os dois utilizadores que pediste:

- `scriptorium@colegio.ramalhao.com` (usar apenas para login)
- `admin@colegio.ramalhao.com` (administrador: pode adicionar alunos/turmas/anos)

IMPORTANTE: Para criar utilizadores no Supabase é necessário usar a Dashboard (GUI) ou a API com a `service_role` key. Nunca comites a `service_role` para o repositório.

Opções:

1) Criar utilizadores via Dashboard (recomendado)
- Abre https://app.supabase.com → seleciona o teu projeto
- Vai a `Authentication → Users` → `Invite user` ou `Add user` (dependendo da UI)
- Usa o email `scriptorium@colegio.ramalhao.com` e `admin@colegio.ramalhao.com`.
- Para o administrador: depois de criar o user, adiciona um registo na tabela `professores` com o email e a role `admin` (ver SQL abaixo).

2) Criar utilizadores via API (programático)
- Usa a `service_role` key do teu projeto (não comitada). Exemplo com curl:

```bash
SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
PROJECT_URL="https://pllmyptwuvxryxfeufcm.supabase.co"

# Criar user
curl -X POST "$PROJECT_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"scriptorium@colegio.ramalhao.com","email_confirm":true}'

curl -X POST "$PROJECT_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@colegio.ramalhao.com","email_confirm":true}'
```

Depois, para associar o `admin` à tabela de `professores` (ou criar um registo administrador), usa a SQL abaixo na consola SQL do Supabase:

```sql
-- Ajusta os nomes de colunas à tua schema
INSERT INTO professores (nome, email, role, criado_em)
VALUES ('Administrador Scriptorium', 'admin@colegio.ramalhao.com', 'admin', now());

-- Registo para o utilizador de serviço/front-end (opcional)
INSERT INTO professores (nome, email, role, criado_em)
VALUES ('Scriptorium', 'scriptorium@colegio.ramalhao.com', 'user', now());
```

Autorização e regras de linha (RLS):
- Se tiveres RLS ativado, cria políticas que permitam leituras públicas para `ocorrencias` e que permitam a um `admin` escrever em `alunos`/`professores`.
- A verificação de `admin` na app pode ser feita consultando a tabela `professores` pelo email do `current user`.

Exemplo de verificação de admin no frontend (pseudo):

```js
const user = await supabase.auth.getUser();
const { data } = await supabase.from('professores').select('*').eq('email', user.data.user.email).single();
if (data?.role === 'admin') { /* mostrar UI admin */ }
```

Se quiseres, eu posso:
- Gerar as políticas RLS de exemplo para o teu schema.
- Implementar a verificação de `admin` no frontend e uma UI para adicionar `alunos`.
- Ajudar a executar os `curl`/SQL se me forneceres a `service_role` key via um método seguro (não pelo chat). Nunca comites a key.
