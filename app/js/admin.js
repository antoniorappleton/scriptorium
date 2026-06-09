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
    el.innerHTML = `<div class='admin-list-item' style='color: var(--text-muted);'>${
      selectedAno
        ? "Nenhuma turma criada para este ano."
        : "Nenhuma turma criada."
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

async function updateUserPasswordByEmail(email, password) {
  if (email !== "scriptorium@colegio-ramalhao.com") {
    throw new Error("Este painel so altera a password da conta Scriptorium.");
  }

  const { data, error } = await window.supabase.functions.invoke(
    "update-scriptorium-password",
    {
      body: { password },
    },
  );
  if (error) {
    throw new Error(
      error.message ||
        "Nao foi possivel chamar a Edge Function update-scriptorium-password.",
    );
  }
  if (data?.error) {
    throw new Error(data.error);
  }
  if (!data?.ok) {
    throw new Error("Resposta inesperada ao atualizar password.");
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
      console.error("Admin check failed", { prof, profError });
      // Show a more informative alert during debugging
      const errMsg = profError
        ? profError.message || String(profError)
        : "Sem permissÃ£o de admin";
      alert(
        "Acesso negado: Apenas administradores podem aceder a esta pÃ¡gina.\n\nDetalhe: " +
          errMsg,
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
    if (!nome) return alert("Nome do ciclo Ã© obrigatÃ³rio");

    const { error } = await window.supabase.from("ciclos").insert([{ nome }]);
    if (error) return alert("Erro a criar ciclo: " + error.message);

    document.getElementById("cicloNome").value = "";
    await loadCiclos();
    // also refresh paste-import ciclos if available
    if (typeof loadCiclosForPaste === "function") await loadCiclosForPaste();
    alert("Ciclo criado com sucesso!");
  });

  document.getElementById("createTurma").addEventListener("click", async () => {
    const nome = document.getElementById("turmaNome").value.trim();
    const ano = Number(document.getElementById("turmaAno").value) || null;
    const ciclo_id = document.getElementById("turmaCiclo").value || null;

    if (!nome) return alert("Nome da turma Ã© obrigatÃ³rio");

    const { error } = await window.supabase
      .from("turmas")
      .insert([{ nome, ano, ciclo_id }]);
    if (error) return alert("Erro a criar turma: " + error.message);

    document.getElementById("turmaNome").value = "";
    document.getElementById("turmaAno").value = "";
    document.getElementById("turmaCiclo").value = "";
    await refreshTurmas();
    // ensure paste-import turmas are updated to include the new turma
    if (typeof loadTurmasForPaste === "function") await loadTurmasForPaste();
    alert("Turma criada com sucesso!");
  });

  const updatePasswordBtn = document.getElementById("updatePasswordBtn");
  if (updatePasswordBtn) {
    updatePasswordBtn.addEventListener("click", async () => {
      const email = document.getElementById("updateUserEmail").value.trim();
      const password = document.getElementById("updateUserPassword").value;
      const statusEl = document.getElementById("updatePasswordStatus");

      if (!password)
        return alert("Insira a nova password para atualizar o utilizador.");
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
          statusEl.textContent =
            "Erro ao atualizar password: " + (err?.message || String(err));
        }
        alert("Erro ao atualizar password: " + (err?.message || String(err)));
      }
    });
  }

  // Toggle password visibility
  const togglePasswordBtn = document.getElementById("togglePasswordBtn");
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", () => {
      const pwd = document.getElementById("updateUserPassword");
      if (!pwd) return;
      if (pwd.type === "password") {
        pwd.type = "text";
        togglePasswordBtn.textContent = "ðŸ™ˆ";
      } else {
        pwd.type = "password";
        togglePasswordBtn.textContent = "ðŸ‘ï¸";
      }
    });
  }
  // --- Colar lista de alunos (import rÃ¡pido) ---
  async function loadCiclosForPaste() {
    const el = document.getElementById("pasteCiclo");
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

  async function loadTurmasForPaste() {
    const el = document.getElementById("pasteTurma");
    if (!el) return;
    const cicloId = document.getElementById("pasteCiclo")?.value || null;
    const anoVal = document.getElementById("pasteAno")?.value || null;
    el.innerHTML = '<option value="">A carregar...</option>';
    let query = window.supabase.from("turmas").select("*").order("nome");
    if (cicloId) query = query.eq("ciclo_id", cicloId);
    if (anoVal) query = query.eq("ano", Number(anoVal));
    const { data, error } = await query;
    if (error) {
      el.innerHTML = '<option value="">Erro a carregar</option>';
      return;
    }
    el.innerHTML =
      '<option value="">-- selecionar turma --</option>' +
      (data || [])
        .map((t) => `<option value="${t.nome}">${t.nome}</option>`)
        .join("");
  }

  // initialize paste import UI
  await loadCiclosForPaste();
  const pasteCicloEl = document.getElementById("pasteCiclo");
  const pasteAnoEl = document.getElementById("pasteAno");
  if (pasteCicloEl) pasteCicloEl.addEventListener("change", loadTurmasForPaste);
  if (pasteAnoEl) pasteAnoEl.addEventListener("change", loadTurmasForPaste);

  const pasteBtn = document.getElementById("pasteImportBtn");
  if (pasteBtn) {
    pasteBtn.addEventListener("click", async () => {
      const statusEl = document.getElementById("pasteImportStatus");
      const namesText = document.getElementById("pasteNames")?.value || "";
      const names = namesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!names.length)
        return alert("Insira pelo menos um nome separado por vÃ­rgula.");
      const anoVal = document.getElementById("pasteAno")?.value;
      const ano = anoVal ? Number(anoVal) : null;
      const turma = document.getElementById("pasteTurma")?.value || null;

      const rows = names.map((n) => ({ nome: n, ano, turma }));

      if (statusEl) {
        statusEl.className = "alert alert-success";
        statusEl.style.display = "block";
        statusEl.textContent = `A inserir ${rows.length} alunos...`;
      }

      const batchSize = 100;
      try {
        for (let i = 0; i < rows.length; i += batchSize) {
          const slice = rows.slice(i, i + batchSize);
          const { error } = await window.supabase.from("alunos").insert(slice);
          if (error) throw error;
        }
        if (statusEl) {
          statusEl.className = "alert alert-success";
          statusEl.textContent = `ImportaÃ§Ã£o concluÃ­da: ${rows.length} alunos inseridos.`;
        }
        document.getElementById("pasteNames").value = "";
        await refreshTurmas();
      } catch (err) {
        console.error("Paste import error", err);
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent =
            "Erro ao importar: " + (err?.message || String(err));
        }
        alert("Erro ao importar: " + (err?.message || String(err)));
      }
    });
  }

  // --- RelatÃ³rios: carregar selects e gerar PDF ---
  async function loadReportCiclos() {
    const el = document.getElementById("reportCiclo");
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
      '<option value="">Todos</option>' +
      (data || [])
        .map((c) => `<option value="${c.id}">${c.nome}</option>`)
        .join("");
  }

  async function loadReportTurmas() {
    const el = document.getElementById("reportTurma");
    if (!el) return;
    const cicloId = document.getElementById("reportCiclo")?.value || null;
    const anoVal = document.getElementById("reportAno")?.value || null;
    el.innerHTML = '<option value="">A carregar...</option>';
    let query = window.supabase.from("turmas").select("*").order("nome");
    if (cicloId) query = query.eq("ciclo_id", cicloId);
    if (anoVal) query = query.eq("ano", Number(anoVal));
    const { data, error } = await query;
    if (error) {
      el.innerHTML = '<option value="">Erro a carregar</option>';
      return;
    }
    el.innerHTML =
      '<option value="">Todas</option>' +
      (data || [])
        .map((t) => `<option value="${t.nome}">${t.nome}</option>`)
        .join("");
  }

  // initialize report selects
  await loadReportCiclos();
  const reportCicloEl = document.getElementById("reportCiclo");
  const reportAnoEl = document.getElementById("reportAno");
  if (reportCicloEl) reportCicloEl.addEventListener("change", loadReportTurmas);
  if (reportAnoEl) reportAnoEl.addEventListener("change", loadReportTurmas);
  await loadReportTurmas();

  const downloadReportBtn = document.getElementById("downloadReportBtn");
  if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", async () => {
      const statusEl = document.getElementById("reportStatus");
      if (statusEl) {
        statusEl.className = "alert alert-success";
        statusEl.style.display = "block";
        statusEl.textContent = "A gerar PDF...";
      }

      const cicloId = document.getElementById("reportCiclo")?.value || null;
      const ano = document.getElementById("reportAno")?.value || null;
      const turma = document.getElementById("reportTurma")?.value || null;
      const start = document.getElementById("reportStart")?.value || null;
      const end = document.getElementById("reportEnd")?.value || null;

      try {
        let query = window.supabase
          .from("ocorrencias")
          .select("*")
          .order("data", { ascending: false });
        if (ano) query = query.eq("ano", Number(ano));
        if (turma) query = query.eq("turma", turma);
        else if (cicloId) {
          const { data: turmasData } = await window.supabase
            .from("turmas")
            .select("nome")
            .eq("ciclo_id", cicloId);
          const nomes = (turmasData || []).map((t) => t.nome);
          if (nomes.length) query = query.in("turma", nomes);
        }
        if (start) query = query.gte("data", start);
        if (end) query = query.lte("data", end);

        const { data: rows, error } = await query;
        if (error) throw error;

        // prepare table body
        const body = (rows || []).map((r) => [
          r.data || (r.created_at ? r.created_at.slice(0, 10) : ""),
          r.aluno_nome || "",
          r.ano || "",
          r.turma || "",
          r.motivo || "",
        ]);

        // Load logo image
        async function loadImageDataURL(url) {
          try {
            const res = await fetch(url);
            const blob = await res.blob();
            return await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            return null;
          }
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const logoData = await loadImageDataURL("assets/logo.png");
        if (logoData) {
          doc.addImage(logoData, "PNG", 40, 30, 60, 60);
        }
        doc.setFontSize(18);
        doc.text("SCRIPTORIUM", 110, 40);
        doc.setFontSize(12);
        doc.text("RelatÃ³rio de OcorrÃªncias", 110, 60);
        const cicloText = (() => {
          if (!cicloId) return "Todos os ciclos";
          const sel = document.getElementById("reportCiclo");
          return sel?.selectedOptions?.[0]?.text || "";
        })();
        const header = `Ciclo: ${cicloText}  Ano: ${ano || "Todos"}  Turma: ${turma || "Todas"}`;
        doc.setFontSize(10);
        doc.text(header, 40, 100);

        doc.autoTable({
          startY: 120,
          head: [["Data", "Aluno", "Ano", "Turma", "Motivo"]],
          body,
          styles: { fontSize: 9, cellPadding: 4 },
          headStyles: { fillColor: [30, 60, 120] },
        });

        const filename = `relatorio_ocorrencias_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);

        if (statusEl) {
          statusEl.className = "alert alert-success";
          statusEl.textContent = `PDF gerado: ${filename}`;
        }
      } catch (err) {
        console.error("Report error", err);
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent =
            "Erro ao gerar relatÃ³rio: " + (err?.message || String(err));
        }
        alert("Erro ao gerar relatÃ³rio: " + (err?.message || String(err)));
      }
    });
  }

  const deleteOccurrencesBtn = document.getElementById("deleteOccurrencesBtn");
  if (deleteOccurrencesBtn) {
    deleteOccurrencesBtn.addEventListener("click", async () => {
      const start = document.getElementById("deleteStart")?.value || null;
      const end = document.getElementById("deleteEnd")?.value || null;
      const statusEl = document.getElementById("deleteOccurrencesStatus");

      if (!start || !end) {
        alert("Defina a data de inÃ­cio e a data de fim.");
        return;
      }
      if (start > end) {
        alert("A data de inÃ­cio nÃ£o pode ser posterior Ã  data de fim.");
        return;
      }

      const ok = confirm(
        `Eliminar definitivamente todas as ocorrÃªncias entre ${start} e ${end}?`,
      );
      if (!ok) return;

      if (statusEl) {
        statusEl.className = "alert alert-success";
        statusEl.style.display = "block";
        statusEl.textContent = "A eliminar ocorrÃªncias...";
      }
      deleteOccurrencesBtn.disabled = true;

      try {
        const { count, error } = await window.supabase
          .from("ocorrencias")
          .delete({ count: "exact" })
          .gte("data", start)
          .lte("data", end);
        if (error) throw error;

        if (statusEl) {
          statusEl.className = "alert alert-success";
          statusEl.textContent = `${count ?? 0} ocorrÃªncia(s) eliminada(s).`;
        }
      } catch (err) {
        console.error("Delete occurrences error", err);
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent =
            "Erro ao eliminar ocorrÃªncias: " + (err?.message || String(err));
        }
        alert("Erro ao eliminar ocorrÃªncias: " + (err?.message || String(err)));
      } finally {
        deleteOccurrencesBtn.disabled = false;
      }
    });
  }
});
