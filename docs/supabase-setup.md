# Instruções de configuração do Supabase

1. Criar um projeto no Supabase: https://app.supabase.com
2. No Query Editor, executar o ficheiro `db/schema.sql` para criar as tabelas.

3. Configurar Auth → Providers: habilitar Email (Magic Link) se quiser login por email.

4. Segurança: configurar Row Level Security (RLS) para `ocorrencias` (exemplo mínimo)

-- Exemplo RLS: permitir insert apenas a utilizadores autenticados
```sql
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY insert_ocorrencias ON ocorrencias FOR INSERT
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
```

5. Preencher `app/js/supabase.js` com `SUPABASE_URL` e `SUPABASE_KEY` (anon/public key).

6. (Opcional) Criar um utilizador professor manualmente em `professores` ou usar Signup.

7. Testes locais: servir a pasta e abrir `/app/index.html`.

Se quiser, posso automatizar a criação das policies SQL para ti ou tentar executar os passos via supabase CLI (necessita autenticação local).
