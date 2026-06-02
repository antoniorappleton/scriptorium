// Substitui os valores abaixo com os dados do teu projeto Supabase
const SUPABASE_URL = "https://XXXXX.supabase.co"; // <- substituir
const SUPABASE_KEY = "public-anon-key"; // <- substituir

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Dica: para desenvolvimento, guarda os valores num ficheiro .env local e não comites a chave privada
