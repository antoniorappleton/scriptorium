# Local development and Live Server

Executa um servidor estático simples para servir a pasta `app/` para que o site funcione localmente.

### Opção 1: Python (nativo)

```bash
# a partir da raiz do repositório
python -m http.server 5500 -d app
# abrir http://localhost:5500/
```

### Opção 2: Node.js (http-server)

```bash
# a partir da raiz do repositório
npx http-server app -p 5500
```

### Opção 3: VS Code Live Server
* Abre a pasta do repositório no VS Code.
* Clica com o botão direito no ficheiro `app/index.html` e escolhe `Open with Live Server`.
* Certifica-te de que as URLs apontam para `http://localhost:5500/` (ou a porta atribuída).

## Supabase: permitir URLs de redirecionamento local

No Dashboard do Supabase → Authentication → Settings, adiciona as seguintes URLs de redirecionamento permitidas (Allowed Redirect URLs):

* `http://localhost:5500/`
* `http://localhost:5500/*`
* `http://localhost:8080/` (caso uses outra porta)

Configura também a URL do Site principal (Site URL):

* `https://antoniorappleton.github.io/scriptorium/`

## Notas Importantes
* Nunca coloques a chave `service_role` (privada) do Supabase no frontend.
* Utiliza sempre a chave `anon` (pública) no ficheiro `app/js/supabase.js`.
