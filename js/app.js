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

  const syncBtn = document.getElementById("syncBtn");
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.textContent = "A sincronizar...";
  }

  for (const p of pendentes) {
    try {
      // Remover propriedades temporárias locais antes de enviar
      const payload = { ...p };
      delete payload._local;

      const { error } = await window.supabase
        .from("ocorrencias")
        .insert([payload]);
      if (error) throw error;
    } catch (err) {
      console.error("Falha na sincronização", err.message);
      alert("Sincronização interrompida: " + err.message);
      checkPendingSync();
      return;
    }
  }

  localStorage.removeItem("pendentes");
  alert("Sincronização concluída com sucesso.");
  checkPendingSync();
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
      .maybeSingle();
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
  list.innerHTML =
    "<div class='admin-list-item' style='color: var(--text-muted);'>A carregar...</div>";
  try {
    const { data, error } = await window.supabase
      .from("alunos")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data || !data.length) {
      list.innerHTML =
        "<div class='admin-list-item' style='color: var(--text-muted);'>Sem alunos adicionados.</div>";
      return;
    }
    list.innerHTML = data
      .map(
        (a) =>
          `<div class="admin-list-item">
            <strong>${a.nome}</strong>
            <span style="color: var(--text-muted); font-size: 11px;">
              ${a.ano ? a.ano + "º" : ""}${a.turma ? " " + a.turma : ""} ${a.ciclo ? "(" + a.ciclo + ")" : ""}
            </span>
          </div>`,
      )
      .join("");
  } catch (e) {
    console.error(e);
    list.innerHTML =
      "<div class='admin-list-item' style='color: var(--error);'>Erro ao carregar alunos.</div>";
  }
}

// Ocorrências dynamic chart using pure client-side SVG
function renderChart(rows) {
  const chartWrapper = document.getElementById("chartWrapper");
  if (!chartWrapper) return;

  const last7Days = [];
  const daysOfWeek = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().slice(0, 10));
  }

  const counts = last7Days.map((date) => {
    return rows.filter((r) => {
      const rDate = r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
      return rDate === date;
    }).length;
  });

  const maxVal = Math.max(...counts, 1);

  let svgContent = `
    <svg viewBox="0 0 700 200" class="chart-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bar-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="var(--primary)" />
          <stop offset="100%" stop-color="var(--secondary)" />
        </linearGradient>
      </defs>
      
      <!-- Grid Lines -->
      <line x1="10" y1="50" x2="690" y2="50" class="chart-grid-line" stroke="var(--surface-border)" stroke-width="1" stroke-dasharray="4,4" />
      <line x1="10" y1="100" x2="690" y2="100" class="chart-grid-line" stroke="var(--surface-border)" stroke-width="1" stroke-dasharray="4,4" />
      <line x1="10" y1="150" x2="690" y2="150" stroke="var(--surface-border)" stroke-width="1" />
  `;

  last7Days.forEach((date, i) => {
    const count = counts[i];
    const weekday = daysOfWeek[new Date(date + "T00:00:00").getDay()];
    const barWidth = 48;
    const slotWidth = 680 / 7;
    const x = 10 + i * slotWidth + (slotWidth - barWidth) / 2;

    const h = (count / maxVal) * 110; // max height 110px
    const y = 150 - h;

    // Bar
    svgContent += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${h}" class="chart-bar" />
    `;

    // Count label
    if (count > 0) {
      svgContent += `
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-family="var(--font)" font-size="12" font-weight="600" fill="var(--text-main)">${count}</text>
      `;
    }

    // Date labels
    svgContent += `
      <text x="${x + barWidth / 2}" y="172" text-anchor="middle" font-family="var(--font)" font-size="11" font-weight="500" fill="var(--text-muted)">${weekday}</text>
      <text x="${x + barWidth / 2}" y="186" text-anchor="middle" font-family="var(--font)" font-size="9" fill="var(--text-muted)">${date.slice(8, 10)}/${date.slice(5, 7)}</text>
    `;
  });

  svgContent += `</svg>`;

  chartWrapper.innerHTML = `
    <div class="chart-title-inline">Ocorrências nos últimos 7 dias</div>
    ${svgContent}
  `;
}

// Calculate and show metrics on dashboard
function updateMetrics(rows) {
  const todayEl = document.getElementById("metric-today");
  const monthEl = document.getElementById("metric-month");
  const yearEl = document.getElementById("metric-year");
  const studentsEl = document.getElementById("metric-students");

  if (!todayEl && !monthEl && !yearEl && !studentsEl) return;

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7); // YYYY-MM
  const currentYearStr = todayStr.slice(0, 4); // YYYY

  let todayCount = 0;
  let monthCount = 0;
  let yearCount = 0;
  const uniqueStudents = new Set();

  rows.forEach((r) => {
    const date = r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
    if (date === todayStr) todayCount++;
    if (date.startsWith(currentMonthStr)) monthCount++;
    if (date.startsWith(currentYearStr)) yearCount++;

    const student = r.alunos?.nome || r.aluno_nome || "";
    if (student) uniqueStudents.add(student);
  });

  if (todayEl) todayEl.textContent = todayCount;
  if (monthEl) monthEl.textContent = monthCount;
  if (yearEl) yearEl.textContent = yearCount;
  if (studentsEl) studentsEl.textContent = uniqueStudents.size;
}

// Show/hide sync button dynamically
function checkPendingSync() {
  const syncBtn = document.getElementById("syncBtn");
  if (!syncBtn) return;
  const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
  if (pendentes.length > 0) {
    syncBtn.style.display = "inline-flex";
    syncBtn.className = "btn btn-sync";
    syncBtn.textContent = `🔄 Sincronizar ${pendentes.length} Pendente(s)`;
  } else {
    syncBtn.style.display = "none";
  }
}

async function carregarOcorrencias(q = "") {
  const listEl = document.getElementById("ocorrenciasList");
  if (!listEl) return;

  listEl.innerHTML =
    "<div style='text-align: center; color: var(--text-muted); padding: 20px;'>A carregar...</div>";
  try {
    let query = window.supabase
      .from("ocorrencias")
      .select("*, alunos(*), professores(*)")
      .order("created_at", { ascending: false });

    if (q) {
      query = query.ilike("aluno_nome", `%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    const rows = pendentes
      .map((p) => ({ ...p, _local: true }))
      .concat(data || []);

    if (!rows.length) {
      listEl.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 14px;">
          Nenhuma ocorrência encontrada.
        </div>`;
    } else {
      listEl.innerHTML = rows
        .map((r) => {
          const nome = r.alunos?.nome || r.aluno_nome || "";
          const dataVal =
            r.data ||
            (r.created_at
              ? r.created_at.slice(0, 10)
              : new Date().toISOString().slice(0, 10));
          const formattedDate = dataVal.split("-").reverse().join("/"); // DD/MM/YYYY
          const badgeClass = r._local
            ? "badge badge-pending"
            : "badge badge-synced";
          const badgeText = r._local ? "Pendente" : "Sincronizado";
          const anoTurmaText = `${r.ano ? r.ano + "º" : ""}${r.turma ? " " + r.turma : ""}`;

          return `
            <div class="ocorrencia-item">
              <div class="ocorrencia-header">
                <div class="ocorrencia-student">${nome}</div>
                <span class="${badgeClass}">${badgeText}</span>
              </div>
              <div class="ocorrencia-meta">
                <span>📅 ${formattedDate}</span>
                ${anoTurmaText ? `<span>• 🏫 ${anoTurmaText}</span>` : ""}
              </div>
              <div class="ocorrencia-reason">${r.motivo || "Sem motivo especificado."}</div>
            </div>
          `;
        })
        .join("");
    }

    updateMetrics(rows);
    renderChart(rows);
  } catch (err) {
    console.error(err);
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    if (pendentes.length) {
      listEl.innerHTML = pendentes
        .map((r) => {
          const formattedDate = r.data.split("-").reverse().join("/");
          const anoTurmaText = `${r.ano ? r.ano + "º" : ""}${r.turma ? " " + r.turma : ""}`;

          return `
            <div class="ocorrencia-item">
              <div class="ocorrencia-header">
                <div class="ocorrencia-student">${r.aluno_nome}</div>
                <span class="badge badge-pending">Pendente</span>
              </div>
              <div class="ocorrencia-meta">
                <span>📅 ${formattedDate}</span>
                ${anoTurmaText ? `<span>• 🏫 ${anoTurmaText}</span>` : ""}
              </div>
              <div class="ocorrencia-reason">${r.motivo}</div>
            </div>
          `;
        })
        .join("");

      updateMetrics(pendentes.map((p) => ({ ...p, _local: true })));
      renderChart(pendentes.map((p) => ({ ...p, _local: true })));
    } else {
      listEl.innerHTML =
        "<div style='text-align: center; color: var(--error); padding: 20px;'>Erro ao carregar ocorrências.</div>";
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
        aluno_nome: alunoNomeEl ? alunoNomeEl.value.trim() : "",
        ano: anoEl ? Number(anoEl.value) : null,
        turma: turmaEl ? turmaEl.value.trim() : null,
        data: dataEl ? dataEl.value : new Date().toISOString().slice(0, 10),
        motivo: motivoEl ? motivoEl.value.trim() : "",
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
        window.location.href = "index.html";
      } else {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Registar";
        }
        alert("Ocorrência guardada localmente (sem ligação à rede).");
        window.location.href = "index.html";
      }
    });
  }

  if (syncBtn) {
    syncBtn.addEventListener("click", () => sincronizarPendentes());
  }

  if (search) {
    let debounce;
    search.addEventListener("input", () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (ocorrenciasListEl) carregarOcorrencias(search.value.trim());
      }, 300);
    });
  }

  // Load occurrences and check pending syncs
  if (ocorrenciasListEl) {
    carregarOcorrencias();
    checkPendingSync();
  }

  // Check admin and wire admin UI if present
  const adminPanel = document.getElementById("adminPanel");
  const adminNavLink = document.getElementById("adminNavLink");

  if (adminPanel || adminNavLink) {
    const isAdmin = await isCurrentUserAdmin();
    if (isAdmin) {
      if (adminPanel) {
        adminPanel.style.display = "block";
        loadAlunos();
      }
      if (adminNavLink) {
        adminNavLink.style.display = "inline-flex";
      }

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
            ano: ano ? Number(ano) : null,
            turma: turma || null,
            ciclo: ciclo || null,
            criado_em: new Date().toISOString(),
          });

          if (ok) {
            addForm.reset();
            loadAlunos();
            alert("Aluno adicionado com sucesso!");
            // Refresh main occurrences to update metrics and auto-completion if applicable
            carregarOcorrencias();
          } else {
            alert("Falha ao adicionar aluno");
          }
        });
      }
    }
  }
});
