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

let adminTurmasCache = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getTurmaLabel(turma) {
  const ano = turma?.ano ? `${turma.ano}.º ano` : "Ano por definir";
  return `${turma?.nome || "Sem nome"} - ${ano}`;
}

function getSelectedManagedTurma() {
  const id = document.getElementById("manageTurma")?.value;
  return adminTurmasCache.find((t) => t.id === id) || null;
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
  adminTurmasCache = turmas.sort(compareTurmas);
  const filtered = selectedAno
    ? adminTurmasCache.filter((t) => String(t.ano) === selectedAno)
    : adminTurmasCache;
  if (!filtered.length) {
    el.innerHTML = `<div class='admin-list-item' style='color: var(--text-muted);'>${
      selectedAno
        ? "Nenhuma turma criada para este ano."
        : "Nenhuma turma criada."
    }</div>`;
    return;
  }
  el.innerHTML = filtered
    .map(
      (t) =>
        `<div class="admin-list-item">
          <div>
            <strong>${escapeHtml(t.nome)} (Ano ${escapeHtml(t.ano || "")})</strong>
            <span style="color: var(--text-muted); font-size: 11px;">Ciclo: ${escapeHtml(t.ciclos?.nome || "Sem Ciclo")}</span>
          </div>
          <button class="icon-btn danger" data-delete-turma-id="${escapeHtml(t.id)}" title="Eliminar turma">x</button>
        </div>`,
    )
    .join("");
}

async function updateUserPasswordByEmail(email, password) {
  if (email !== "scriptorium@colegio-ramalhao.com") {
    throw new Error("Este painel só altera a password da conta Scriptorium.");
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
        "Não foi possível chamar a Edge Function update-scriptorium-password.",
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
        : "Sem permissão de admin";
      alert(
        "Acesso negado: Apenas administradores podem aceder a esta página.\n\nDetalhe: " +
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
  await loadManageTurmas();

  const manageAnoEl = document.getElementById("manageAno");
  const manageTurmaEl = document.getElementById("manageTurma");
  if (manageAnoEl) manageAnoEl.addEventListener("change", loadManageTurmas);
  if (manageTurmaEl) {
    manageTurmaEl.addEventListener("change", loadStudentsForManagedTurma);
  }

  const turmasListEl = document.getElementById("turmasList");
  if (turmasListEl) {
    turmasListEl.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-delete-turma-id]");
      if (!btn) return;
      await deleteTurmaById(btn.dataset.deleteTurmaId);
    });
  }

  const deleteSelectedTurmaBtn = document.getElementById(
    "deleteSelectedTurmaBtn",
  );
  if (deleteSelectedTurmaBtn) {
    deleteSelectedTurmaBtn.addEventListener("click", async () => {
      const turma = getSelectedManagedTurma();
      if (!turma) {
        alert("Selecione uma turma para eliminar.");
        return;
      }
      await deleteTurmaById(turma.id);
    });
  }

  const studentsListEl = document.getElementById("studentsByTurmaList");
  if (studentsListEl) {
    studentsListEl.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-delete-student-id]");
      if (!btn) return;
      await deleteStudentById(btn.dataset.deleteStudentId);
    });
  }

  function setStudentsCount(count) {
    const el = document.getElementById("studentsCount");
    if (el) el.textContent = `${count} aluno${count === 1 ? "" : "s"}`;
  }

  function setStudentsStatus(message, type = "success") {
    const el = document.getElementById("studentsByTurmaStatus");
    if (!el) return;
    if (!message) {
      el.className = "";
      el.textContent = "";
      return;
    }
    el.className = type === "error" ? "alert alert-error" : "alert alert-success";
    el.style.display = "block";
    el.textContent = message;
  }

  async function loadManageTurmas() {
    const el = document.getElementById("manageTurma");
    const ano = document.getElementById("manageAno")?.value || "";
    if (!el) return;

    const previous = el.value;
    const filtered = ano
      ? adminTurmasCache.filter((t) => String(t.ano) === ano)
      : adminTurmasCache;

    if (!filtered.length) {
      el.innerHTML = '<option value="">Sem turmas</option>';
      setStudentsCount(0);
      document.getElementById("studentsByTurmaList").innerHTML =
        '<div class="admin-list-item" style="color: var(--text-muted)">Nenhuma turma encontrada.</div>';
      return;
    }

    el.innerHTML =
      '<option value="">-- selecionar turma --</option>' +
      filtered
        .map(
          (t) =>
            `<option value="${escapeHtml(t.id)}">${escapeHtml(getTurmaLabel(t))}</option>`,
        )
        .join("");
    if (filtered.some((t) => t.id === previous)) el.value = previous;
    await loadStudentsForManagedTurma();
  }

  async function loadStudentsForManagedTurma() {
    const list = document.getElementById("studentsByTurmaList");
    const turma = getSelectedManagedTurma();
    setStudentsStatus("");
    setStudentsCount(0);
    if (!list) return;
    if (!turma) {
      list.innerHTML =
        '<div class="admin-list-item" style="color: var(--text-muted)">Selecione uma turma para ver os alunos.</div>';
      return;
    }

    list.innerHTML =
      '<div class="admin-list-item" style="color: var(--text-muted)">A carregar alunos...</div>';

    const byId = new Map();
    const byTurmaId = await window.supabase
      .from("alunos")
      .select("id,nome,ano,turma,turma_id")
      .eq("turma_id", turma.id)
      .order("nome");
    if (byTurmaId.error) throw byTurmaId.error;
    (byTurmaId.data || []).forEach((student) => byId.set(student.id, student));

    let fallbackQuery = window.supabase
      .from("alunos")
      .select("id,nome,ano,turma,turma_id")
      .eq("turma", turma.nome)
      .order("nome");
    if (turma.ano) fallbackQuery = fallbackQuery.eq("ano", Number(turma.ano));
    const byName = await fallbackQuery;
    if (byName.error) throw byName.error;
    (byName.data || []).forEach((student) => byId.set(student.id, student));

    const students = Array.from(byId.values()).sort((a, b) =>
      String(a.nome || "").localeCompare(String(b.nome || ""), "pt", {
        sensitivity: "base",
      }),
    );
    setStudentsCount(students.length);

    if (!students.length) {
      list.innerHTML =
        '<div class="admin-list-item" style="color: var(--text-muted)">Esta turma ainda não tem alunos importados.</div>';
      return;
    }

    list.innerHTML = students
      .map(
        (student) => `<div class="admin-list-item">
          <div>
            <strong>${escapeHtml(student.nome)}</strong>
            <span style="color: var(--text-muted); font-size: 11px;">${escapeHtml(student.ano || turma.ano || "")}.º ano | ${escapeHtml(student.turma || turma.nome || "")}</span>
          </div>
          <button class="icon-btn danger" data-delete-student-id="${escapeHtml(student.id)}" title="Eliminar aluno">x</button>
        </div>`,
      )
      .join("");
  }

  async function deleteStudentById(studentId) {
    const ok = confirm("Eliminar definitivamente este aluno importado?");
    if (!ok) return;
    try {
      const { count, error } = await window.supabase
        .from("alunos")
        .delete({ count: "exact" })
        .eq("id", studentId);
      if (error) throw error;
      if (!count) {
        throw new Error(
          "Nenhum aluno foi eliminado. Verifique as permissões RLS da tabela alunos.",
        );
      }
      setStudentsStatus("Aluno eliminado com sucesso.");
      await loadStudentsForManagedTurma();
    } catch (err) {
      console.error("Delete student error", err);
      setStudentsStatus(
        "Erro ao eliminar aluno: " + (err?.message || String(err)),
        "error",
      );
    }
  }

  async function deleteTurmaById(turmaId) {
    const turma = adminTurmasCache.find((t) => t.id === turmaId);
    if (!turma) return;
    const ok = confirm(
      `Eliminar definitivamente a turma ${getTurmaLabel(turma)} e os alunos associados?`,
    );
    if (!ok) return;

    try {
      setStudentsStatus("A eliminar turma...");
      const byTurmaId = await window.supabase
        .from("alunos")
        .delete({ count: "exact" })
        .eq("turma_id", turma.id);
      if (byTurmaId.error) throw byTurmaId.error;

      let fallbackDelete = window.supabase
        .from("alunos")
        .delete({ count: "exact" })
        .eq("turma", turma.nome);
      if (turma.ano) fallbackDelete = fallbackDelete.eq("ano", Number(turma.ano));
      const fallbackResult = await fallbackDelete;
      if (fallbackResult.error) throw fallbackResult.error;

      const deletedStudents =
        (byTurmaId.count || 0) + (fallbackResult.count || 0);

      const deleteTurma = await window.supabase
        .from("turmas")
        .delete({ count: "exact" })
        .eq("id", turma.id);
      if (deleteTurma.error) throw deleteTurma.error;
      if (!deleteTurma.count) {
        throw new Error(
          "A turma não foi eliminada. Verifique as permissões RLS da tabela turmas.",
        );
      }

      setStudentsStatus(
        `Turma eliminada com sucesso. ${deletedStudents} aluno(s) eliminado(s).`,
      );
      await refreshTurmas();
      await loadManageTurmas();
      if (typeof loadTurmasForPaste === "function") await loadTurmasForPaste();
      if (typeof loadReportTurmas === "function") await loadReportTurmas();
    } catch (err) {
      console.error("Delete turma error", err);
      setStudentsStatus(
        "Erro ao eliminar turma: " + (err?.message || String(err)),
        "error",
      );
      alert("Erro ao eliminar turma: " + (err?.message || String(err)));
    }
  }

  document.getElementById("createCiclo").addEventListener("click", async () => {
    const nome = document.getElementById("cicloNome").value.trim();
    if (!nome) return alert("Nome do ciclo é obrigatório");

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

    if (!nome) return alert("Nome da turma é obrigatório");

    const { error } = await window.supabase
      .from("turmas")
      .insert([{ nome, ano, ciclo_id }]);
    if (error) return alert("Erro a criar turma: " + error.message);

    document.getElementById("turmaNome").value = "";
    document.getElementById("turmaAno").value = "";
    document.getElementById("turmaCiclo").value = "";
    await refreshTurmas();
    await loadManageTurmas();
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
        togglePasswordBtn.textContent = "Ocultar";
      } else {
        pwd.type = "password";
        togglePasswordBtn.textContent = "Ver";
      }
    });
  }
  // --- Colar lista de alunos (import rápido) ---
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
        .map(
          (t) =>
            `<option value="${escapeHtml(t.id)}" data-nome="${escapeHtml(t.nome)}" data-ano="${escapeHtml(t.ano || "")}" data-ciclo-id="${escapeHtml(t.ciclo_id || "")}">${escapeHtml(t.nome)}</option>`,
        )
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
        return alert("Insira pelo menos um nome separado por vírgula.");
      const turmaSelect = document.getElementById("pasteTurma");
      const turmaId = turmaSelect?.value || null;
      const selectedTurmaOption = turmaSelect?.selectedOptions?.[0] || null;
      const anoVal =
        document.getElementById("pasteAno")?.value ||
        selectedTurmaOption?.dataset?.ano ||
        "";
      const ano = anoVal ? Number(anoVal) : null;
      const turma = selectedTurmaOption?.dataset?.nome || null;
      const cicloId = document.getElementById("pasteCiclo")?.value || null;

      if (!turmaId || !turma) {
        return alert("Selecione a turma antes de importar alunos.");
      }

      const rows = names.map((n) => ({
        nome: n,
        ano,
        turma,
        turma_id: turmaId,
        ciclo_id: cicloId || selectedTurmaOption?.dataset?.cicloId || null,
      }));

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
          statusEl.textContent = `Importação concluída: ${rows.length} alunos inseridos.`;
        }
        document.getElementById("pasteNames").value = "";
        await refreshTurmas();
        await loadManageTurmas();
        await loadStudentsForManagedTurma();
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

  // --- Relatórios: carregar selects e gerar PDF ---
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
        doc.text("Relatório de Ocorrências", 110, 60);
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
            "Erro ao gerar relatório: " + (err?.message || String(err));
        }
        alert("Erro ao gerar relatório: " + (err?.message || String(err)));
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
        alert("Defina a data de início e a data de fim.");
        return;
      }
      if (start > end) {
        alert("A data de início não pode ser posterior à data de fim.");
        return;
      }

      const ok = confirm(
        `Eliminar definitivamente todas as ocorrências entre ${start} e ${end}?`,
      );
      if (!ok) return;

      if (statusEl) {
        statusEl.className = "alert alert-success";
        statusEl.style.display = "block";
        statusEl.textContent = "A eliminar ocorrências...";
      }
      deleteOccurrencesBtn.disabled = true;

      try {
        const existing = await window.supabase
          .from("ocorrencias")
          .select("id", { count: "exact", head: true })
          .gte("data", start)
          .lte("data", end);
        if (existing.error) throw existing.error;

        const { count, error } = await window.supabase
          .from("ocorrencias")
          .delete({ count: "exact" })
          .gte("data", start)
          .lte("data", end);
        if (error) throw error;
        let deletedCount = count || 0;
        if ((existing.count || 0) > 0 && !deletedCount) {
          const rpcResult = await window.supabase.rpc(
            "delete_ocorrencias_between",
            {
              start_date: start,
              end_date: end,
            },
          );
          if (rpcResult.error) throw rpcResult.error;
          deletedCount = rpcResult.data || 0;
        }

        if (statusEl) {
          if ((existing.count || 0) > 0 && !deletedCount) {
            statusEl.className = "alert alert-error";
            statusEl.textContent =
              "Foram encontradas ocorrências, mas nenhuma foi eliminada. Pode já terem sido removidas por outro utilizador.";
          } else {
            statusEl.className = "alert alert-success";
            statusEl.textContent = `${deletedCount} ocorrência(s) eliminada(s).`;
          }
        }
      } catch (err) {
        console.error("Delete occurrences error", err);
        if (statusEl) {
          statusEl.className = "alert alert-error";
          statusEl.textContent =
            "Erro ao eliminar ocorrências: " + (err?.message || String(err));
        }
        alert("Erro ao eliminar ocorrências: " + (err?.message || String(err)));
      } finally {
        deleteOccurrencesBtn.disabled = false;
      }
    });
  }
});
