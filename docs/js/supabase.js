// Substitui os valores abaixo com os dados do teu projeto Supabase
const SUPABASE_URL = "https://pllmyptwuvxryxfeufcm.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbG15cHR3dXZ4cnl4ZmV1ZmNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTA0NjgsImV4cCI6MjA5NTk2NjQ2OH0.xrZoCyXTHUi1jxjEuH_ymbAGZDVR6ZtVN1lN54EWJE0"; // <- substituir

// Ensure the supabase client is available and create a client instance.
// Expose a promise `window.supabaseReady` that resolves when `window.supabase` (the client) is ready.
function loadSupabaseLib() {
  return new Promise((resolve, reject) => {
    if (window.supabase && typeof window.supabase.createClient === "function") {
      return resolve(window.supabase);
    }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js";
    s.onload = () => resolve(window.supabase);
    s.onerror = (e) => reject(new Error("Failed to load supabase lib"));
    document.head.appendChild(s);
  });
}

window.supabaseReady = loadSupabaseLib()
  .then((lib) => {
    // lib may be the global library object; create a client
    const client =
      lib && typeof lib.createClient === "function"
        ? lib.createClient(SUPABASE_URL, SUPABASE_KEY)
        : typeof supabase !== "undefined" &&
            typeof supabase.createClient === "function"
          ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
          : null;
    if (!client) throw new Error("Unable to initialize Supabase client");
    window.supabase = client; // client used by app.js
    return client;
  })
  .catch((err) => {
    console.error("supabase init error", err);
  });

// Dica: para desenvolvimento, guarda os valores num ficheiro .env local e não comites a chave privada
