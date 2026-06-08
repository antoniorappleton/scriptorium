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

function compareTurmas(a, b) {
  const anoA = Number.isFinite(a.ano) ? a.ano : Infinity;
  const anoB = Number.isFinite(b.ano) ? b.ano : Infinity;
  if (anoA !== anoB) return anoA - anoB;
  return String(a.nome || "").localeCompare(String(b.nome || ""), "pt", {
    sensitivity: "base",
  });
}

async function refreshTurmas() {
  const el = document.getElementById("turmasList");
  const filterEl = document.getElementById("turmasAnoFiltro");
  const selectedAno = filterEl?.value;
  if (!el) return;
  el.innerHTML =
    "<div class='admin-list-item' style='color: var(--text-muted);'>A carregar...</div>";
  const { data, error } = await window.supabase
    .from("turmas")
    .select("*, ciclos(*)");
  if (error) {
    el.innerHTML =
      "<div class='admin-list-item' style='color: var(--error);'>Erro ao carregar turmas: " +
      error.message +
      "</div>";
    return;
  }

  const turmas = (data || []).slice();
  const filtered = selectedAno
    ? turmas.filter((t) => String(t.ano) === selectedAno)
    : turmas;
  if (!filtered.length) {
    el.innerHTML =
      `<div class='admin-list-item' style='color: var(--text-muted);'>${
        selectedAno ? "Nenhuma turma criada para este ano." : "Nenhuma turma criada."
      }</div>`;
    return;
  }
  filtered.sort(compareTurmas);
  el.innerHTML = filtered
    .map(
      (t) =>
        `<div class="admin-list-item">
          <strong>${t.nome} (Ano ${t.ano || ""})</strong>
          <span style="color: var(--text-muted); font-size: 11px;">Ciclo: ${t.ciclos?.nome || "Sem Ciclo"}</span>
        </div>`,
    )
    .join("");
}

async function getUserByEmail(email) {
  if (!window.supabase.auth?.admin) {
    throw new Error("API de administração do Supabase não está disponível.");
  }

  let response;
  try {
    response = await window.supabase.auth.admin.listUsers({ search: email });
  } catch (e) {
    response = await window.supabase.auth.admin.listUsers();
  }

  if (response?.error) {
    throw response.error;
  }

  const users = Array.isArray(response?.data?.users)
    ? response.data.users
    : Array.isArray(response?.data)
    ? response.data
    : [];
  return users.find((u) => u.email === email) || null;
}

async function updateUserPasswordByEmail(email, password) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error("Utilizador não encontrado: " + email);
  }

  if (!window.supabase.auth?.admin?.updateUserById) {
    throw new Error("A atualização de utilizador não está disponível na API Supabase atual.");
  }

  const { error } = await window.supabase.auth.admin.updateUserById(user.id, {
    password,
  });
  if (error) {
    throw error;
  }
  return true;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.supabaseReady) await window.supabaseReady;

  // Security checks: force login and role == admin
  try {
    const {
      data: { session },
    } = await window.supabase.auth.getSession();
    if (!session) {
      window.location.href = "login.html";
      return;
    }

    const { data: prof, error: profError } = await window.supabase
      .from("professores")
      .select("role")
      .eq("email", session.user.email)
      .maybeSingle();

    if (profError || prof?.role !== "admin") {
      alert(
        "Acesso negado: Apenas administradores podem aceder a esta página.",
      );
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

  const anoFilterEl = document.getElementById("turmasAnoFiltro");
  if (anoFilterEl) {
    anoFilterEl.addEventListener("change", refreshTurmas);
  }

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

  const updatePasswordBtn = document.getElementById("updatePasswordBtn");
  if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener("click", async () => {
      const email = document.getElementById("updateUserEmail").value.trim();
      const password = document.getElementById("updateUserPassword").value;
      const statusEl = document.getElementById("updatePasswordStatus");

      if (!password) return alert("Insira a nova password para atualizar o utilizador.");
      if (statusEl) {
        statusEl.className = "alert alert-success";
        statusEl.style.display = "block";
        statusEl.textContent = "A atualizar password...";
      }

      try {
        await updateUserPasswordByEmail(email, password);
        if (statusEl) {
          statusEl.className = "alert alert-success";
          statusEl.textContent = "Password atualizada com sucesso.";
        }
        document.getElementById("updateUserPassword").value = "";
      } catch (err) {
        console.error("Password update error", err);
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent = "Erro ao atualizar password: " +
            (err?.message || String(err));
        }
        alert("Erro ao atualizar password: " + (err?.message || String(err)));
      }
    });
  }

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
            nome:
              r.nome ||
              r.Name ||
              r.Nome ||
              r.NOME ||
              r["Nome do aluno"] ||
              r["nome do aluno"] ||
              r["Nome do Aluno"],
            ano:
              r.ano || r.ANO || r["Ano"] || r["ano"]
                ? Number(r.ano || r.ANO || r["Ano"] || r["ano"])
                : null,
            turma: r.turma || r.Turma || r["Turma"] || null,
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
          statusEl.textContent =
            "Importação concluída: " + rows.length + " alunos inseridos.";
        }
        document.getElementById("csvFile").value = "";
        await refreshTurmas();
      },
      error: (parseError) => {
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent = "Erro ao processar CSV: " + parseError.message;
        }
      },
    });
  });
});
