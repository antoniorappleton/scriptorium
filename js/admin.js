async function loadCiclos() {
  const el = document.getElementById("turmaCiclo");
  if (!el) return;
  el.innerHTML = '<option value="">A carregar...</option>';
  const { data, error } = await window.supabase
    .from("ciclos")
    .select("*")
    .order("nome");
  if (error) {
    el.innerHTML = '<option value="">Erro a carregar</option>';
    return;
  }
  el.innerHTML =
    '<option value="">-- selecionar ciclo --</option>' +
    (data || [])
      .map((c) => `<option value="${c.id}">${c.nome}</option>`)
      .join("");
}

async function refreshTurmas() {
  const el = document.getElementById("turmasList");
  if (!el) return;
  el.innerHTML = "<div class='admin-list-item' style='color: var(--text-muted);'>A carregar...</div>";
  const { data, error } = await window.supabase
    .from("turmas")
    .select("*, ciclos(*)")
    .order("nome");
  if (error) {
    el.innerHTML = "<div class='admin-list-item' style='color: var(--error);'>Erro ao carregar turmas: " + error.message + "</div>";
    return;
  }
  if (!data || !data.length) {
    el.innerHTML = "<div class='admin-list-item' style='color: var(--text-muted);'>Nenhuma turma criada.</div>";
    return;
  }
  el.innerHTML = (data || [])
    .map(
      (t) =>
        `<div class="admin-list-item">
          <strong>${t.nome} (Ano ${t.ano || ""})</strong>
          <span style="color: var(--text-muted); font-size: 11px;">Ciclo: ${t.ciclos?.nome || "Sem Ciclo"}</span>
        </div>`,
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.supabaseReady) await window.supabaseReady;
  
  // Security checks: force login and role == admin
  try {
    const { data: { session } } = await window.supabase.auth.getSession();
    if (!session) {
      window.location.href = "login.html";
      return;
    }
    
    const { data: prof, error: profError } = await window.supabase
      .from("professores")
      .select("role")
      .eq("email", session.user.email)
      .single();
      
    if (profError || prof?.role !== "admin") {
      alert("Acesso negado: Apenas administradores podem aceder a esta página.");
      window.location.href = "index.html";
      return;
    }
  } catch (err) {
    console.error("Security check error", err);
    window.location.href = "login.html";
    return;
  }

  // Admin access granted, load data
  await loadCiclos();
  await refreshTurmas();

  document.getElementById("createCiclo").addEventListener("click", async () => {
    const nome = document.getElementById("cicloNome").value.trim();
    if (!nome) return alert("Nome do ciclo é obrigatório");
    
    const { error } = await window.supabase.from("ciclos").insert([{ nome }]);
    if (error) return alert("Erro a criar ciclo: " + error.message);
    
    document.getElementById("cicloNome").value = "";
    await loadCiclos();
    alert("Ciclo criado com sucesso!");
  });

  document.getElementById("createTurma").addEventListener("click", async () => {
    const nome = document.getElementById("turmaNome").value.trim();
    const ano = Number(document.getElementById("turmaAno").value) || null;
    const ciclo_id = document.getElementById("turmaCiclo").value || null;
    
    if (!nome) return alert("Nome da turma é obrigatório");
    
    const { error } = await window.supabase
      .from("turmas")
      .insert([{ nome, ano, ciclo_id }]);
    if (error) return alert("Erro a criar turma: " + error.message);
    
    document.getElementById("turmaNome").value = "";
    document.getElementById("turmaAno").value = "";
    document.getElementById("turmaCiclo").value = "";
    await refreshTurmas();
    alert("Turma criada com sucesso!");
  });

  document.getElementById("importCsv").addEventListener("click", async () => {
    const f = document.getElementById("csvFile").files[0];
    if (!f) return alert("Por favor, selecione um ficheiro CSV primeiro.");
    
    const statusEl = document.getElementById("importStatus");
    if (statusEl) {
      statusEl.className = "alert alert-success";
      statusEl.style.display = "block";
      statusEl.textContent = "A ler ficheiro CSV...";
    }

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
          .map((r) => ({
            nome: r.nome || r.Name || r.Nome || r.NOME,
            ano: r.ano ? Number(r.ano) : r.ANO ? Number(r.ANO) : null,
            turma: r.turma || r.Turma || null,
            criado_em: new Date().toISOString(),
          }))
          .filter((r) => r.nome);
          
        if (statusEl) {
          statusEl.textContent = "A importar " + rows.length + " alunos...";
        }
        
        // bulk insert in batches
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const slice = rows.slice(i, i + batchSize);
          const { error } = await window.supabase.from("alunos").insert(slice);
          if (error) {
            if (statusEl) {
              statusEl.className = "alert alert-error";
              statusEl.textContent = "Erro na importação: " + error.message;
            }
            return alert("Erro na importação: " + error.message);
          }
        }
        
        if (statusEl) {
          statusEl.className = "alert alert-success";
          statusEl.textContent = "Importação concluída: " + rows.length + " alunos inseridos.";
        }
        document.getElementById("csvFile").value = "";
        await refreshTurmas();
      },
      error: (parseError) => {
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent = "Erro ao processar CSV: " + parseError.message;
        }
      }
    });
  });
});
