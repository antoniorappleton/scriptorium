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

let registarTurmasCache = [];
let registarCiclosCache = [];

async function loadRegistarCiclos() {
  const select = document.getElementById("ciclo");
  if (!select) return;
  select.innerHTML = '<option value="">A carregar ciclos...</option>';
  const { data, error } = await window.supabase
    .from("ciclos")
    .select("*")
    .order("nome");
  if (error) {
    console.error("Erro ao carregar ciclos", error);
    select.innerHTML = '<option value="">Erro a carregar ciclos</option>';
    return;
  }
  registarCiclosCache = data || [];
  select.innerHTML =
    '<option value="">Todos os ciclos</option>' +
    registarCiclosCache
      .map((c) => `<option value="${c.id}">${c.nome}</option>`)
      .join("");
}

async function loadRegistarTurmas() {
  const { data, error } = await window.supabase
    .from("turmas")
    .select("*, ciclos(*)")
    .order("nome");
  if (error) {
    console.error("Erro ao carregar turmas", error);
    registarTurmasCache = [];
    return;
  }
  registarTurmasCache = data || [];
}

function getRegistarAvailableYears(selectedCicloId) {
  return Array.from(
    new Set(
      registarTurmasCache
        .filter(
          (t) => !selectedCicloId || String(t.ciclo_id) === selectedCicloId,
        )
        .map((t) => Number(t.ano))
        .filter((ano) => Number.isFinite(ano)),
    ),
  ).sort((a, b) => a - b);
}

function getRegistarFilteredTurmas(selectedCicloId, selectedAno) {
  return registarTurmasCache.filter((t) => {
    if (selectedCicloId && String(t.ciclo_id) !== selectedCicloId) return false;
    if (selectedAno && String(t.ano) !== selectedAno) return false;
    return true;
  });
}

function updateRegistarAnoOptions() {
  const cicloEl = document.getElementById("ciclo");
  const anoEl = document.getElementById("ano");
  if (!anoEl) return;
  const selectedCycle = cicloEl?.value || "";
  const years = getRegistarAvailableYears(selectedCycle);
  const currentValue = anoEl.value;

  if (!years.length) {
    anoEl.innerHTML = '<option value="">Nenhum ano disponível</option>';
    anoEl.disabled = true;
    return;
  }

  anoEl.disabled = false;
  anoEl.innerHTML =
    '<option value="">Selecione um ano</option>' +
    years.map((ano) => `<option value="${ano}">${ano}º ano</option>`).join("");
  if (currentValue && years.includes(Number(currentValue))) {
    anoEl.value = currentValue;
  }
}

function updateRegistarTurmaOptions() {
  const cicloEl = document.getElementById("ciclo");
  const anoEl = document.getElementById("ano");
  const turmaEl = document.getElementById("turma");
  if (!turmaEl) return;
  const selectedCycle = cicloEl?.value || "";
  const selectedAno = anoEl?.value || "";
  const turmas = getRegistarFilteredTurmas(selectedCycle, selectedAno);
  const currentValue = turmaEl.value;

  if (!turmas.length) {
    turmaEl.innerHTML = `<option value="">${
      selectedAno ? "Nenhuma turma encontrada" : "Sem turmas disponíveis"
    }</option>`;
    turmaEl.disabled = true;
    return;
  }

  turmaEl.disabled = false;
  turmaEl.innerHTML =
    '<option value="">Selecione uma turma</option>' +
    turmas
      .map(
        (t) =>
          `<option value="${t.nome}">${t.nome} (${t.ano}º${
            t.ciclos?.nome ? " - " + t.ciclos.nome : ""
          })</option>`,
      )
      .join("");
  if (currentValue && turmas.some((t) => t.nome === currentValue)) {
    turmaEl.value = currentValue;
  }
}

async function initRegistarFilters() {
  await Promise.all([loadRegistarCiclos(), loadRegistarTurmas()]);
  updateRegistarAnoOptions();
  updateRegistarTurmaOptions();
  await loadAlunosForRegistar();

  const cicloEl = document.getElementById("ciclo");
  const anoEl = document.getElementById("ano");
  const turmaEl = document.getElementById("turma");
  if (cicloEl) {
    cicloEl.addEventListener("change", () => {
      updateRegistarAnoOptions();
      updateRegistarTurmaOptions();
      loadAlunosForRegistar();
    });
  }
  if (anoEl) {
    anoEl.addEventListener("change", () => {
      updateRegistarTurmaOptions();
      loadAlunosForRegistar();
    });
  }
  if (turmaEl) {
    turmaEl.addEventListener("change", loadAlunosForRegistar);
  }
}

// Autocomplete: fetch aluno suggestions filtered by nome, ano, turma
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function fetchAlunoSuggestions(q, ano, turma) {
  if (!q) return [];
  let query = window.supabase
    .from("alunos")
    .select("id,nome,ano,turma")
    .ilike("nome", `%${q}%`)
    .limit(30);
  if (ano) query = query.eq("ano", Number(ano));
  if (turma) query = query.eq("turma", turma);
  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

function populateAlunosDatalist(items) {
  const dl = document.getElementById("alunosDatalist");
  if (!dl) return;
  dl.innerHTML = (items || [])
    .map((i) => `<option value="${i.nome}"></option>`)
    .join("");
}

// Load alunos for the registar select, filtered by ciclo/ano/turma
async function loadAlunosForRegistar() {
  const select = document.getElementById("alunoSelect");
  if (!select) return;
  const cicloId = document.getElementById("ciclo")?.value || null;
  const ano = document.getElementById("ano")?.value || null;
  const turma = document.getElementById("turma")?.value || null;

  if (!cicloId || !ano || !turma) {
    select.innerHTML =
      '<option value="">Selecione ciclo, ano e turma primeiro</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = '<option value="">A carregar alunos...</option>';
  select.disabled = true;

  try {
    const query = window.supabase
      .from("alunos")
      .select("id,nome,ano,turma")
      .eq("ano", Number(ano))
      .eq("turma", turma)
      .order("nome");
    const { data, error } = await query;
    if (error) throw error;
    const items = data || [];
    if (!items.length) {
      select.innerHTML = '<option value="">Nenhum aluno encontrado</option>';
      select.disabled = true;
      return;
    }
    select.disabled = false;
    select.innerHTML =
      '<option value="">Selecione um aluno</option>' +
      items
        .map(
          (a) =>
            `<option value="${a.nome}" data-id="${a.id}">${a.nome}${a.ano ? " — " + a.ano + "º" : ""}${a.turma ? " — " + a.turma : ""}</option>`,
        )
        .join("");
  } catch (e) {
    console.error("loadAlunosForRegistar error", e);
    select.innerHTML = '<option value="">Erro ao carregar alunos</option>';
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

let dashboardRows = [];

function formatMonthLabel(yearMonth) {
  const [year, month] = yearMonth.split("-");
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${monthNames[Number(month) - 1] || month} ${year}`;
}

function getDashboardFilters() {
  return {
    ano: document.getElementById("dashboard-filter-ano")?.value || "",
    turma: document.getElementById("dashboard-filter-turma")?.value || "",
    month: document.getElementById("dashboard-filter-month")?.value || "",
    period: document.getElementById("dashboard-filter-period")?.value || "all",
  };
}

function applyDashboardFilters(rows) {
  const { ano, turma, month, period } = getDashboardFilters();
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const monthStart = `${todayStr.slice(0, 7)}-01`;
  const last7 = new Date(today);
  last7.setDate(today.getDate() - 6);
  const last30 = new Date(today);
  last30.setDate(today.getDate() - 29);
  const last7Str = last7.toISOString().slice(0, 10);
  const last30Str = last30.toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);
  const currentYearStr = todayStr.slice(0, 4);

  return (rows || []).filter((r) => {
    const date = r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
    if (!date) return false;
    if (ano && String(r.ano) !== ano) return false;
    if (turma && String(r.turma || r.alunos?.turma || "") !== turma)
      return false;
    if (month && !date.startsWith(month)) return false;

    if (period === "today" && date !== todayStr) return false;
    if (period === "thisMonth" && !date.startsWith(currentMonthStr))
      return false;
    if (period === "thisYear" && !date.startsWith(currentYearStr)) return false;
    if (period === "last7" && date < last7Str) return false;
    if (period === "last30" && date < last30Str) return false;
    return true;
  });
}

function updateDashboardFilters(rows) {
  const anoSelect = document.getElementById("dashboard-filter-ano");
  const turmaSelect = document.getElementById("dashboard-filter-turma");
  const monthSelect = document.getElementById("dashboard-filter-month");
  if (!anoSelect || !turmaSelect || !monthSelect) return;

  const anos = new Set();
  const turmas = new Set();
  const meses = new Set();
  rows.forEach((r) => {
    if (r.ano != null && r.ano !== "") anos.add(String(r.ano));
    const turma = String(r.turma || r.alunos?.turma || "").trim();
    if (turma) turmas.add(turma);
    const date = r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
    if (date) meses.add(date.slice(0, 7));
  });

  const selectedAno = anoSelect.value;
  const selectedTurma = turmaSelect.value;
  const selectedMonth = monthSelect.value;

  anoSelect.innerHTML =
    "<option value=''>Todos os anos</option>" +
    [...anos]
      .sort((a, b) => Number(a) - Number(b))
      .map((value) => `<option value="${value}">${value}º ano</option>`)
      .join("");
  turmaSelect.innerHTML =
    "<option value=''>Todas as turmas</option>" +
    [...turmas]
      .sort((a, b) => a.localeCompare(b, "pt", { sensitivity: "base" }))
      .map((value) => `<option value="${value}">${value}</option>`)
      .join("");
  monthSelect.innerHTML =
    "<option value=''>Todos os meses</option>" +
    [...meses]
      .sort()
      .map(
        (value) =>
          `<option value="${value}">${formatMonthLabel(value)}</option>`,
      )
      .join("");

  if (selectedAno && [...anos].includes(selectedAno))
    anoSelect.value = selectedAno;
  if (selectedTurma && [...turmas].includes(selectedTurma))
    turmaSelect.value = selectedTurma;
  if (selectedMonth && [...meses].includes(selectedMonth))
    monthSelect.value = selectedMonth;
}

function renderDashboard(rows) {
  const filteredRows = applyDashboardFilters(rows);
  updateMetrics(filteredRows);
  renderFrequentStudents(filteredRows);
  renderChart(filteredRows);
}

function getStudentKey(row) {
  return (
    row.aluno_id ||
    row.alunos?.id ||
    String(row.alunos?.nome || row.aluno_nome || "").trim().toLowerCase()
  );
}

function renderFrequentStudents(rows) {
  const listEl = document.getElementById("frequentStudentsList");
  if (!listEl) return;

  const grouped = new Map();
  (rows || []).forEach((row) => {
    const nome = String(row.alunos?.nome || row.aluno_nome || "").trim();
    if (!nome) return;
    const key = getStudentKey(row);
    if (!key) return;
    const current = grouped.get(key) || {
      nome,
      ano: row.ano || row.alunos?.ano || "",
      turma: row.turma || row.alunos?.turma || "",
      count: 0,
    };
    current.count += 1;
    if (!current.ano && (row.ano || row.alunos?.ano)) {
      current.ano = row.ano || row.alunos?.ano;
    }
    if (!current.turma && (row.turma || row.alunos?.turma)) {
      current.turma = row.turma || row.alunos?.turma;
    }
    grouped.set(key, current);
  });

  const students = [...grouped.values()]
    .filter((student) => student.count >= 3)
    .sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, "pt"));

  if (!students.length) {
    listEl.innerHTML =
      "<div class='admin-list-item' style='color: var(--text-muted);'>Nenhum aluno com 3 ou mais ocorrências nos filtros atuais.</div>";
    return;
  }

  listEl.innerHTML = students
    .map((student) => {
      const anoTurma = `${student.ano ? student.ano + "º" : ""}${
        student.turma ? " " + student.turma : ""
      }`.trim();
      return `<div class="admin-list-item">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <strong>${student.nome}</strong>
          ${
            anoTurma
              ? `<span style="color: var(--text-muted); font-size: 11px;">${anoTurma}</span>`
              : ""
          }
        </div>
        <span class="badge badge-pending">${student.count} ocorrências</span>
      </div>`;
    })
    .join("");
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

    dashboardRows = rows;
    updateDashboardFilters(rows);
    const displayRows = applyDashboardFilters(rows);

    if (!displayRows.length) {
      listEl.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 30px; font-size: 14px;">
          Nenhuma ocorrência encontrada.
        </div>`;
    } else {
      listEl.innerHTML = displayRows
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

    updateMetrics(displayRows);
    renderFrequentStudents(displayRows);
    renderChart(displayRows);
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

      const localRows = pendentes.map((p) => ({ ...p, _local: true }));
      updateMetrics(localRows);
      renderFrequentStudents(localRows);
      renderChart(localRows);
    } else {
      listEl.innerHTML =
        "<div style='text-align: center; color: var(--error); padding: 20px;'>Erro ao carregar ocorrências.</div>";
      renderFrequentStudents([]);
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
    await initRegistarFilters();
    // Motivo presets
    const motivoSelect = document.getElementById("motivoSelect");
    const motivoTextarea = document.getElementById("motivo");
    function updateMotivoFromSelect() {
      if (!motivoSelect || !motivoTextarea) return;
      const v = motivoSelect.value;
      if (v === "Outro") {
        motivoTextarea.value = "";
        motivoTextarea.readOnly = false;
        motivoTextarea.focus();
      } else {
        motivoTextarea.value = v;
        motivoTextarea.readOnly = true;
      }
    }
    if (motivoSelect) {
      motivoSelect.addEventListener("change", updateMotivoFromSelect);
      updateMotivoFromSelect();
    }
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alunoSelectEl = document.getElementById("alunoSelect");
      const anoEl = document.getElementById("ano");
      const turmaEl = document.getElementById("turma");
      const motivoEl = document.getElementById("motivo");
      const dataEl = document.getElementById("data");
      const submitBtn = form.querySelector("button[type=submit]");
      const selectedAluno =
        alunoSelectEl?.options[alunoSelectEl.selectedIndex] || null;

      const dados = {
        aluno_id: selectedAluno?.dataset?.id || null,
        aluno_nome: alunoSelectEl ? alunoSelectEl.value.trim() : "",
        ano: anoEl ? Number(anoEl.value) : null,
        turma: turmaEl ? turmaEl.value.trim() : null,
        data: dataEl ? dataEl.value : new Date().toISOString().slice(0, 10),
        motivo: motivoEl ? motivoEl.value.trim() : "",
        created_at: new Date().toISOString(),
      };

      if (!dados.aluno_id || !dados.aluno_nome) {
        alert("Selecione um aluno da lista.");
        return;
      }

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

  [
    "dashboard-filter-ano",
    "dashboard-filter-turma",
    "dashboard-filter-month",
    "dashboard-filter-period",
  ].forEach((filterId) => {
    const filterEl = document.getElementById(filterId);
    if (filterEl) {
      filterEl.addEventListener("change", () => {
        if (ocorrenciasListEl) {
          const searchQuery = search?.value.trim() || "";
          carregarOcorrencias(searchQuery);
        } else {
          renderDashboard(dashboardRows);
        }
      });
    }
  });

  // Load occurrences and check pending syncs
  if (ocorrenciasListEl) {
    carregarOcorrencias();
    checkPendingSync();
  }

  // Export occurrences (Dashboard) -> PDF
  async function loadDashboardReportCiclos() {
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

  async function loadDashboardReportTurmas() {
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

  async function generateDashboardPDF() {
    const statusEl = document.getElementById("reportStatusDashboard");
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

      const { data, error } = await query;
      if (error) throw error;

      const rows = data || [];
      const body = (rows || []).map((r) => [
        r.data || (r.created_at ? r.created_at.slice(0, 10) : ""),
        r.aluno_nome || "",
        r.ano || "",
        r.turma || "",
        r.motivo || "",
      ]);

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
      if (logoData) doc.addImage(logoData, "PNG", 40, 30, 60, 60);
      doc.setFontSize(18);
      doc.text("SCRIPTORIUM", 110, 40);
      doc.setFontSize(12);
      doc.text("Relatório de Ocorrências", 110, 60);

      // header with applied filters
      const cicloText = (() => {
        if (!cicloId) return "Todos os ciclos";
        const sel = document.getElementById("reportCiclo");
        return sel?.selectedOptions?.[0]?.text || "";
      })();
      const header = `Ciclo: ${cicloText}  Ano: ${ano || "Todos"}  Turma: ${turma || "Todas"}`;
      doc.setFontSize(10);
      doc.text(header, 40, 100);
      if (start || end) {
        doc.text(
          `Período: ${start || "início"} a ${end || "fim"}`,
          40,
          114,
        );
      }

      doc.autoTable({
        startY: start || end ? 134 : 120,
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
      console.error("dashboard report error", err);
      if (statusEl) {
        statusEl.className = "alert alert-error";
        statusEl.textContent =
          "Erro ao gerar PDF: " + (err?.message || String(err));
      }
      alert("Erro ao gerar PDF: " + (err?.message || String(err)));
    }
  }

  const downloadBtn = document.getElementById("downloadOcorrenciasReport");
  if (downloadBtn) {
    await loadDashboardReportCiclos();
    const reportCicloEl = document.getElementById("reportCiclo");
    const reportAnoEl = document.getElementById("reportAno");
    if (reportCicloEl)
      reportCicloEl.addEventListener("change", loadDashboardReportTurmas);
    if (reportAnoEl)
      reportAnoEl.addEventListener("change", loadDashboardReportTurmas);
    await loadDashboardReportTurmas();
    downloadBtn.addEventListener("click", generateDashboardPDF);
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
