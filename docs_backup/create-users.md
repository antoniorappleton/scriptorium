# Criar utilizadores e associar role (Supabase)

Abaixo tens exemplos `curl` (Admin API) para criar utilizadores e SQL para associar roles na tabela `professores`.

NUNCA coloques a `SERVICE_ROLE_KEY` no repositório. Substitui os placeholders localmente antes de executar.

VARIÁVEIS (substitui):
- `SERVICE_ROLE_KEY` — a tua service_role key (privada)
- `PROJECT_URL` — exemplo: `https://pllmyptwuvxryxfeufcm.supabase.co`

1) Criar utilizador via Admin API (cURL)

```bash
SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
PROJECT_URL="https://pllmyptwuvxryxfeufcm.supabase.co"

# Criar user simples (sem password) e confirmar email
curl -X POST "$PROJECT_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"scriptorium@colegio-ramalhao.com","email_confirm":true}'

# Criar administrador
curl -X POST "$PROJECT_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@colegio-ramalhao.com","email_confirm":true}'
```

Observação: podes também criar utilizadores via Dashboard (Authentication → Users) sem expor keys.

2) Associar role na tabela `professores` (usar o Query Editor da Dashboard ou psql conectado ao DB)

```sql
-- Ajusta nomes de colunas conforme o teu schema
INSERT INTO professores (nome, email, role, criado_em)
VALUES ('Scriptorium', 'scriptorium@colegio-ramalhao.com', 'user', now());

INSERT INTO professores (nome, email, role, criado_em)
VALUES ('Administrador Scriptorium', 'admin@colegio-ramalhao.com', 'admin', now());
```

3) Alternativa: usar a API REST do Supabase (exemplo com anon key para operações não-privilegiadas)

```bash
# EXEMPLO: apenas para operações permitidas pela policy (não para criar users)
ANON_KEY="<ANON_KEY>"
PROJECT_URL="https://pllmyptwuvxryxfeufcm.supabase.co"

curl -X POST "$PROJECT_URL/rest/v1/professores" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"nome":"Scriptorium","email":"scriptorium@colegio-ramalhao.com","role":"user"}'
```

Se quiseres, posso gerar um script bash completo que: cria o user via Admin API e insere o registo na tabela `professores` (executado localmente, com confirmação antes de usar a key).