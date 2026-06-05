// Application version
window.APP_VERSION = "0.1.2";

async function registarOcorrencia(dados) {
  try {
    const { error } = await window.supabase.from("ocorrencias").insert([dados]);
    if (error) throw error;
    carregarOcorrencias();
    return { ok: true };
  } catch (err) {
    console.warn("Envio falhou — guardando localmente", err?.message || err);
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    pendentes.push(dados);
    localStorage.setItem("pendentes", JSON.stringify(pendentes));
    carregarOcorrencias();
    return { ok: false, error: err };
  }
}

async function sincronizarPendentes() {
  const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
  if (!pendentes.length) return alert("Nenhum registo pendente.");
  for (const p of pendentes) {
    try {
      const { error } = await window.supabase.from("ocorrencias").insert([p]);
      if (error) throw error;
    } catch (err) {
      console.error("Falha na sincronização", err.message);
      return alert("Sincronização interrompida: " + err.message);
    }
  }
  localStorage.removeItem("pendentes");
  alert("Sincronização concluída.");
  carregarOcorrencias();
}

// --- Admin helpers: check role, manage alunos
async function isCurrentUserAdmin() {
  try {
    const userResp = await window.supabase.auth.getUser();
    const user = userResp?.data?.user;
    if (!user) return false;
    const email = user.email;
    const { data, error } = await window.supabase
      .from("professores")
      .select("role")
      .eq("email", email)
      .single();
    if (error) return false;
    return data?.role === "admin";
  } catch (e) {
    console.error("isCurrentUserAdmin error", e);
    return false;
  }
}

// Sign out helper - used by header button
async function signOut() {
  try {
    if (window.supabaseReady) await window.supabaseReady;
    const { error } = await window.supabase.auth.signOut();
    if (error) {
      alert("Erro no logout: " + error.message);
      return;
    }
    // Clear local state
    localStorage.removeItem("pendentes");
    window.location.href = "login.html";
  } catch (e) {
    console.error("signOut error", e);
    alert("Erro no logout");
  }
}

async function addAluno(payload) {
  try {
    const { error } = await window.supabase.from("alunos").insert([payload]);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("addAluno error", e);
    return false;
  }
}

async function loadAlunos() {
  const list = document.getElementById("alunosList");
  if (!list) return;
  list.innerHTML = "Carregando...";
  try {
    const { data, error } = await window.supabase
      .from("alunos")
      .select("*")
      .order("nome", { ascending: true })
      .limit(200);
    if (error) throw error;
    if (!data || !data.length) {
      list.innerHTML = "<div class='text-sm text-gray-500'>Sem alunos</div>";
      return;
    }
    list.innerHTML = data
      .map(
        (a) =>
          `<div class="py-1">${a.nome} — ${a.ano || ""} ${a.turma || ""} ${a.ciclo ? "— " + a.ciclo : ""}</div>`,
      )
      .join("");
  } catch (e) {
    console.error(e);
    list.innerHTML =
      "<div class='text-sm text-red-500'>Erro a carregar alunos</div>";
  }
}

async function carregarOcorrencias(q = "") {
  const listEl = document.getElementById("ocorrenciasList");
  listEl.innerHTML = "Carregando...";
  try {
    let query = window.supabase
      .from("ocorrencias")
      .select("*, alunos(*), professores(*)")
      .order("data", { ascending: false });
    if (q) query = query.ilike("alunos.nome", `%${q}%`);
    const { data, error } = await query;
    if (error) throw error;
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    const rows = (data || []).concat(
      pendentes.map((p) => ({ ...p, _local: true })),
    );
    if (!rows.length) listEl.innerHTML = "<p>Sem ocorrências</p>";
    else
      listEl.innerHTML = rows
        .map((r) => {
          const nome = r.alunos?.nome || r.aluno_nome || "";
          const data = r.data || new Date().toISOString().slice(0, 10);
          return `<div class="oc">${nome} — ${r.ano || ""}${r.turma ? " " + r.turma : ""} — ${data} — ${r.motivo || ""} ${r._local ? '<span class="badge">(pendente)</span>' : ""}</div>`;
        })
        .join("");
  } catch (err) {
    console.error(err);
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    if (pendentes.length) {
      listEl.innerHTML = pendentes
        .map(
          (r) =>
            `<div class="oc">${r.alunoNome} — ${r.ano} ${r.turma} — ${r.data} — ${r.motivo} <span class="badge">(pendente)</span></div>`,
        )
        .join("");
    } else {
      listEl.innerHTML = "<p>Erro ao carregar ocorrências.</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.supabaseReady) {
    try {
      await window.supabaseReady;
    } catch (e) {
      console.error("Supabase initialization failed", e);
    }
  }
  const form = document.getElementById("ocorrenciaForm");
  const syncBtn = document.getElementById("syncBtn");
  const search = document.getElementById("search");
  const ocorrenciasListEl = document.getElementById("ocorrenciasList");

  // If form exists (on registar page), wire submit handling and default date
  if (form) {
    const dataInput = document.getElementById("data");
    if (dataInput) dataInput.value = new Date().toISOString().slice(0, 10);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alunoNomeEl = document.getElementById("alunoNome");
      const anoEl = document.getElementById("ano");
      const turmaEl = document.getElementById("turma");
      const motivoEl = document.getElementById("motivo");
      const dataEl = document.getElementById("data");
      const submitBtn = form.querySelector("button[type=submit]");

      const dados = {
        aluno_nome: alunoNomeEl ? alunoNomeEl.value : "",
        ano: anoEl ? Number(anoEl.value) : null,
        turma: turmaEl ? turmaEl.value : null,
        data: dataEl ? dataEl.value : new Date().toISOString().slice(0, 10),
        motivo: motivoEl ? motivoEl.value : "",
        created_at: new Date().toISOString(),
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "A registar…";
      }

      const res = await registarOcorrencia(dados);

      if (res?.ok) {
        if (submitBtn) submitBtn.textContent = "Registar";
        form.reset();
        if (dataEl) dataEl.value = new Date().toISOString().slice(0, 10);
        // redireciona para o index após registo
        window.location.href = "index.html";
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Registar";
        }
        alert(
          "Falha no registo: " +
            (res?.error?.message || "sem ligação; guardado localmente"),
        );
      }
    });
  }

  if (syncBtn) syncBtn.addEventListener("click", () => sincronizarPendentes());

  if (search) {
    let debounce;
    search.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (ocorrenciasListEl) carregarOcorrencias(search.value.trim());
      }, 300);
    });
  }

  // Load occurrences only if the list container exists
  if (ocorrenciasListEl) carregarOcorrencias();

  // Check admin and wire admin UI if present
  const adminPanel = document.getElementById("adminPanel");
  if (adminPanel) {
    const isAdmin = await isCurrentUserAdmin();
    if (isAdmin) {
      adminPanel.classList.remove("hidden");
      loadAlunos();
      const addForm = document.getElementById("addAlunoForm");
      if (addForm) {
        addForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const nome = document.getElementById("alunoNomeAdmin")?.value?.trim();
          const ano = document.getElementById("alunoAnoAdmin")?.value?.trim();
          const turma = document
            .getElementById("alunoTurmaAdmin")
            ?.value?.trim();
          const ciclo = document
            .getElementById("alunoCicloAdmin")
            ?.value?.trim();
          if (!nome) return alert("Nome do aluno é obrigatório");
          const ok = await addAluno({
            nome,
            ano: ano || null,
            turma: turma || null,
            ciclo: ciclo || null,
            criado_em: new Date().toISOString(),
          });
          if (ok) {
            addForm.reset();
            loadAlunos();
            alert("Aluno adicionado");
          } else alert("Falha ao adicionar aluno");
        });
      }
    }
  }
});
