Local development and Live Server

Run a simple static server serving the `docs/` directory so the site behaves like GitHub Pages.

Python (built-in):

```bash
# from repo root
python -m http.server 5500 -d docs
# open http://localhost:5500/
```

Node (http-server):

```bash
npx http-server docs -p 5500
```

VS Code Live Server:
- Open `docs/index.html` in VS Code, right-click, `Open with Live Server`.
- Ensure Live Server serves the `docs/` folder as the root.

Supabase: allow localhost redirect URLs

In the Supabase Dashboard → Authentication → Settings add the following Allowed Redirect URLs:

- `http://localhost:5500/`
- `http://localhost:5500/*`

Also add the Site URL if not set:

- `https://antoniorappleton.github.io/scriptorium/`

Notes
- The `SERVICE_ROLE_KEY` must never be used in the browser — use the `anon` key in `docs/js/supabase.js`.
- When running locally, ensure `docs/js/supabase.js` contains the `SUPABASE_URL` and the `anon` `SUPABASE_KEY`.
