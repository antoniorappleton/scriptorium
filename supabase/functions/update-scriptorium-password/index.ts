import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Secrets Supabase em falta na Edge Function." }, 500);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return json({ error: "Sessão em falta." }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.email) {
    return json({ error: "Sessão inválida." }, 401);
  }

  const { data: professor, error: roleError } = await adminClient
    .from("professores")
    .select("role")
    .eq("email", user.email)
    .maybeSingle();

  if (roleError || professor?.role !== "admin") {
    return json({ error: "Apenas administradores podem alterar esta password." }, 403);
  }

  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!password || String(password).length < 8) {
    return json({ error: "A nova password deve ter pelo menos 8 caracteres." }, 400);
  }

  const targetEmail = "scriptorium@colegio-ramalhao.com";
  const { data: usersData, error: listError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (listError) {
    return json({ error: listError.message }, 500);
  }

  const targetUser = usersData.users.find((candidate) => candidate.email === targetEmail);
  if (!targetUser) {
    return json({ error: `Utilizador não encontrado: ${targetEmail}` }, 404);
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    targetUser.id,
    { password },
  );

  if (updateError) {
    return json({ error: updateError.message }, 500);
  }

  return json({ ok: true });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
