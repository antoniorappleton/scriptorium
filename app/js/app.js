// Depois de "Sair", o browser pode restaurar esta página a partir da cache
// (bfcache) ao premir "retroceder", sem voltar a correr o auth-check inline
// de cada página. Forçar reload garante que esse check corre sempre e
// expulsa para login.html se já não houver sessão.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});

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
  const alunoSearchEl = document.getElementById("alunoSearch");

  // Using the ciclo/ano/turma cascade takes over the aluno list, so drop any
  // active free-text search to avoid the two mechanisms fighting each other.
  function clearAlunoSearch() {
    if (alunoSearchEl) alunoSearchEl.value = "";
  }

  if (cicloEl) {
    cicloEl.addEventListener("change", () => {
      clearAlunoSearch();
      updateRegistarAnoOptions();
      updateRegistarTurmaOptions();
      loadAlunosForRegistar();
    });
  }
  if (anoEl) {
    anoEl.addEventListener("change", () => {
      clearAlunoSearch();
      updateRegistarTurmaOptions();
      loadAlunosForRegistar();
    });
  }
  if (turmaEl) {
    turmaEl.addEventListener("change", () => {
      clearAlunoSearch();
      loadAlunosForRegistar();
    });
  }

  if (alunoSearchEl) {
    const debouncedSearch = debounce(async (q) => {
      if (!q) {
        await loadAlunosForRegistar();
        return;
      }
      const select = document.getElementById("alunoSelect");
      if (select) {
        select.innerHTML = '<option value="">A pesquisar...</option>';
        select.disabled = true;
      }
      const items = await fetchAlunoSuggestions(q, null, null);
      renderAlunoSelectOptions(items);
    }, 300);
    alunoSearchEl.addEventListener("input", (e) => {
      debouncedSearch(e.target.value.trim());
    });
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

// Renders <option> elements for the aluno select, embedding ano/turma so the
// submit handler can use them even when the student was found via a free-text
// search instead of the ciclo/ano/turma cascade.
function renderAlunoSelectOptions(items) {
  const select = document.getElementById("alunoSelect");
  if (!select) return;
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
          `<option value="${a.nome}" data-id="${a.id}" data-ano="${a.ano ?? ""}" data-turma="${a.turma ?? ""}">${a.nome}${a.ano ? " — " + a.ano + "º" : ""}${a.turma ? " — " + a.turma : ""}</option>`,
      )
      .join("");
}

// Load alunos for the registar select, progressively filtered by whichever
// of ciclo/ano/turma are already selected — the list narrows as each filter
// is picked, instead of waiting for all three.
async function loadAlunosForRegistar() {
  const select = document.getElementById("alunoSelect");
  if (!select) return;
  const cicloId = document.getElementById("ciclo")?.value || null;
  const ano = document.getElementById("ano")?.value || null;
  const turma = document.getElementById("turma")?.value || null;

  if (!cicloId && !ano && !turma) {
    select.innerHTML =
      '<option value="">Pesquise o nome acima ou selecione ciclo, ano ou turma</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = '<option value="">A carregar alunos...</option>';
  select.disabled = true;

  try {
    let query = window.supabase
      .from("alunos")
      .select("id,nome,ano,turma")
      .order("nome");
    if (cicloId) query = query.eq("ciclo_id", cicloId);
    if (ano) query = query.eq("ano", Number(ano));
    if (turma) query = query.eq("turma", turma);
    const { data, error } = await query;
    if (error) throw error;
    renderAlunoSelectOptions(data || []);
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
    // Volta ao hub da Comunidade (não à login.html desta app) — ver
    // https://antoniorappleton.github.io/, que lista todas as apps.
    // replace() em vez de href: não deixa esta página autenticada no
    // histórico, para "retroceder" não voltar a mostrá-la.
    window.location.replace("https://antoniorappleton.github.io/");
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
let lastDisplayRows = [];

function deleteOccurrenceIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z"></path>
  </svg>`;
}

function editOccurrenceIconSvg() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 20h4.2L18.8 9.4l-4.2-4.2L4 15.8V20Zm2-3.2 8.6-8.6 1.2 1.2L7.2 18H6v-1.2ZM18.4 3.6l2 2a1 1 0 0 1 0 1.4l-1.9 1.9-4.2-4.2 1.9-1.9a1 1 0 0 1 1.4 0Z"></path>
  </svg>`;
}

// Looks up the full row (synced or still-pending) behind an edit/delete
// click — the rendered HTML only carries id/localIndex in data attributes,
// not every field, so the handler needs the source row to prefill the form.
function findDisplayRow({ id, localIndex }) {
  if (localIndex !== null && localIndex !== undefined && localIndex !== "") {
    return lastDisplayRows.find(
      (r) => r._local && String(r._pendingIndex) === String(localIndex),
    );
  }
  if (id) return lastDisplayRows.find((r) => !r._local && r.id === id);
  return null;
}

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
  renderOcorrenciasMaps(rows);
}

function getStudentKey(row) {
  return (
    row.aluno_id ||
    row.alunos?.id ||
    String(row.alunos?.nome || row.aluno_nome || "").trim().toLowerCase()
  );
}

// "Chegou atrasado" ao primeiro bloco (8h25-9h10) não conta para o
// destaque de alunos com 3+ ocorrências — é o tempo mais afetado por
// atrasos pontuais (trânsito, transportes) e não um padrão disciplinar.
function isExcludedFromFrequentCount(row) {
  return (
    row.motivo === "Chegou atrasado" && row.bloco_horario === "08:25-09:10"
  );
}

function getFrequentStudentsMotivoFilter() {
  return (
    document.getElementById("frequentStudentsMotivoFilter")?.value || ""
  );
}

function renderFrequentStudents(rows) {
  const listEl = document.getElementById("frequentStudentsList");
  if (!listEl) return;

  const motivoFilter = getFrequentStudentsMotivoFilter();
  const grouped = new Map();
  (rows || [])
    .filter((row) => !isExcludedFromFrequentCount(row))
    .filter((row) => !motivoFilter || row.motivo === motivoFilter)
    .forEach((row) => {
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
      .map((p, index) => ({ ...p, _local: true, _pendingIndex: index }))
      .concat(data || []);

    dashboardRows = rows;
    updateDashboardFilters(rows);
    const displayRows = applyDashboardFilters(rows);
    lastDisplayRows = displayRows;

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

          const itemAttrs = r._local
            ? `data-local-index="${r._pendingIndex}"`
            : `data-id="${r.id || ""}"`;

          return `
            <div class="ocorrencia-item">
              <div class="ocorrencia-header">
                <div class="ocorrencia-student">${nome}</div>
                <div class="ocorrencia-actions">
                  <span class="${badgeClass}">${badgeText}</span>
                  <button
                    type="button"
                    class="icon-btn edit-ocorrencia-btn"
                    title="Editar ocorrência"
                    aria-label="Editar ocorrência"
                    ${itemAttrs}
                  >
                    ${editOccurrenceIconSvg()}
                  </button>
                  <button
                    type="button"
                    class="icon-btn danger delete-ocorrencia-btn"
                    title="Eliminar ocorrência"
                    aria-label="Eliminar ocorrência"
                    ${itemAttrs}
                  >
                    ${deleteOccurrenceIconSvg()}
                  </button>
                </div>
              </div>
              <div class="ocorrencia-meta">
                <span>📅 ${formattedDate}</span>
                ${r.bloco_horario ? `<span>• 🕒 ${r.bloco_horario}</span>` : ""}
                ${anoTurmaText ? `<span>• 🏫 ${anoTurmaText}</span>` : ""}
                ${r.diretor_turma ? `<span>• 👤 DT: ${r.diretor_turma}</span>` : ""}
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
    renderOcorrenciasMaps(rows);
  } catch (err) {
    console.error(err);
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    if (pendentes.length) {
      listEl.innerHTML = pendentes
        .map((r, index) => {
          const formattedDate = r.data.split("-").reverse().join("/");
          const anoTurmaText = `${r.ano ? r.ano + "º" : ""}${r.turma ? " " + r.turma : ""}`;

          return `
            <div class="ocorrencia-item">
              <div class="ocorrencia-header">
                <div class="ocorrencia-student">${r.aluno_nome}</div>
                <div class="ocorrencia-actions">
                  <span class="badge badge-pending">Pendente</span>
                  <button
                    type="button"
                    class="icon-btn edit-ocorrencia-btn"
                    title="Editar ocorrência"
                    aria-label="Editar ocorrência"
                    data-local-index="${index}"
                  >
                    ${editOccurrenceIconSvg()}
                  </button>
                  <button
                    type="button"
                    class="icon-btn danger delete-ocorrencia-btn"
                    title="Eliminar ocorrência"
                    aria-label="Eliminar ocorrência"
                    data-local-index="${index}"
                  >
                    ${deleteOccurrenceIconSvg()}
                  </button>
                </div>
              </div>
              <div class="ocorrencia-meta">
                <span>📅 ${formattedDate}</span>
                ${r.bloco_horario ? `<span>• 🕒 ${r.bloco_horario}</span>` : ""}
                ${anoTurmaText ? `<span>• 🏫 ${anoTurmaText}</span>` : ""}
                ${r.diretor_turma ? `<span>• 👤 DT: ${r.diretor_turma}</span>` : ""}
              </div>
              <div class="ocorrencia-reason">${r.motivo}</div>
            </div>
          `;
        })
        .join("");

      const localRows = pendentes.map((p, index) => ({
        ...p,
        _local: true,
        _pendingIndex: index,
      }));
      lastDisplayRows = localRows;
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

async function eliminarOcorrencia({ id, localIndex, searchQuery = "" }) {
  if (localIndex !== null && localIndex !== undefined && localIndex !== "") {
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    const index = Number(localIndex);
    if (!Number.isInteger(index) || index < 0 || index >= pendentes.length) {
      alert("Não foi possível encontrar a ocorrência pendente.");
      return;
    }
    pendentes.splice(index, 1);
    localStorage.setItem("pendentes", JSON.stringify(pendentes));
    checkPendingSync();
    await carregarOcorrencias(searchQuery);
    return;
  }

  if (!id) {
    alert("Não foi possível identificar a ocorrência.");
    return;
  }

  const { count, error } = await window.supabase
    .from("ocorrencias")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) {
    alert("Erro ao eliminar ocorrência: " + error.message);
    return;
  }
  let deletedCount = count || 0;
  if (!deletedCount) {
    const rpcResult = await window.supabase.rpc("delete_ocorrencia_by_id", {
      occurrence_id: id,
    });
    if (rpcResult.error) {
      alert("Erro ao eliminar ocorrência: " + rpcResult.error.message);
      return;
    }
    deletedCount = rpcResult.data || 0;
  }
  if (!deletedCount) {
    alert("A ocorrência não foi eliminada. Pode já ter sido removida.");
    return;
  }
  await carregarOcorrencias(searchQuery);
}

// Updates data/bloco_horario/motivo on an existing occurrence — synced rows
// go through Supabase, still-pending ones are patched in localStorage so a
// retry later syncs the edited version instead of the original.
async function editarOcorrencia({ id, localIndex, changes, searchQuery = "" }) {
  if (localIndex !== null && localIndex !== undefined && localIndex !== "") {
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    const index = Number(localIndex);
    if (!Number.isInteger(index) || index < 0 || index >= pendentes.length) {
      alert("Não foi possível encontrar a ocorrência pendente.");
      return false;
    }
    pendentes[index] = { ...pendentes[index], ...changes };
    localStorage.setItem("pendentes", JSON.stringify(pendentes));
    await carregarOcorrencias(searchQuery);
    return true;
  }

  if (!id) {
    alert("Não foi possível identificar a ocorrência.");
    return false;
  }

  const { error } = await window.supabase
    .from("ocorrencias")
    .update(changes)
    .eq("id", id);
  if (error) {
    alert("Erro ao atualizar ocorrência: " + error.message);
    return false;
  }
  await carregarOcorrencias(searchQuery);
  return true;
}

// --- Relatório PDF: agrupamento, heatmap e gráfico de motivos ---
// Partilhado pelo relatório do Dashboard (abaixo) e pelo painel Admin
// (admin.js, carregado depois de app.js e reutilizando estas funções).

const PDF_PAGE_MARGIN = 40;

const PDF_BLOCOS_HORARIO = [
  "08:25-09:10",
  "09:15-10:00",
  "10:20-11:05",
  "11:10-11:55",
  "12:05-13:05",
  "14:10-14:55",
  "15:00-15:45",
];

// Rampa "semântica de calor" (verde = menor ocorrência, vermelho = maior
// ocorrência) do status palette do design system: good/warning/serious/critical.
const PDF_HEAT_STOPS = [
  { t: 0, rgb: [12, 163, 12] },
  { t: 1 / 3, rgb: [250, 178, 25] },
  { t: 2 / 3, rgb: [236, 131, 90] },
  { t: 1, rgb: [208, 59, 59] },
];

function pdfHeatColor(t) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  for (let i = 0; i < PDF_HEAT_STOPS.length - 1; i++) {
    const a = PDF_HEAT_STOPS[i];
    const b = PDF_HEAT_STOPS[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const localT = (clamped - a.t) / (b.t - a.t || 1);
      return [0, 1, 2].map((k) =>
        Math.round(a.rgb[k] + (b.rgb[k] - a.rgb[k]) * localT),
      );
    }
  }
  return PDF_HEAT_STOPS[PDF_HEAT_STOPS.length - 1].rgb;
}

// Nunca confiar só na cor: o texto usa branco/tinta escura segundo a
// luminosidade do preenchimento, para o número ficar sempre legível.
function pdfPickTextColor(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 150 ? [11, 11, 11] : [255, 255, 255];
}

// Só avança de página quando o próximo bloco de conteúdo realmente não
// couber — nunca criar páginas em branco no fim do relatório.
function pdfEnsureSpace(doc, y, neededHeight) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + neededHeight > pageHeight - PDF_PAGE_MARGIN) {
    doc.addPage();
    return PDF_PAGE_MARGIN;
  }
  return y;
}

// Agrupa as ocorrências por aluno (ordenadas por nome, depois por data
// descendente) para o nome aparecer uma única vez na tabela, com as
// respetivas ocorrências (data/bloco/motivo) listadas a seguir.
function buildGroupedReportBody(rows) {
  const sorted = [...rows].sort((a, b) => {
    const nameCompare = String(a.aluno_nome || "").localeCompare(
      String(b.aluno_nome || ""),
      "pt",
      { sensitivity: "base" },
    );
    if (nameCompare !== 0) return nameCompare;
    return String(b.data || "").localeCompare(String(a.data || ""));
  });

  const body = [];
  let i = 0;
  while (i < sorted.length) {
    const alunoNome = sorted[i].aluno_nome || "(sem nome)";
    let j = i;
    while (j < sorted.length && (sorted[j].aluno_nome || "(sem nome)") === alunoNome) {
      j++;
    }
    const group = sorted.slice(i, j);
    const first = group[0];
    const subtitleParts = [];
    if (first.ano) subtitleParts.push(`${first.ano}.º ano`);
    if (first.turma) subtitleParts.push(first.turma);
    if (first.diretor_turma) subtitleParts.push(`DT: ${first.diretor_turma}`);
    const subtitle = subtitleParts.join(" · ");
    const alunoCellText = subtitle ? `${alunoNome}\n${subtitle}` : alunoNome;

    group.forEach((r, idx) => {
      const dataFmt = r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
      const rowCells = [dataFmt, r.bloco_horario || "", r.motivo || ""];
      if (idx === 0) {
        body.push([
          {
            content: alunoCellText,
            rowSpan: group.length,
            styles: { valign: "middle" },
          },
          ...rowCells,
        ]);
      } else {
        body.push(rowCells);
      }
    });
    i = j;
  }
  return body;
}

// Cruza bloco horário x turma para o mapa de calor. Limita o número de
// colunas (turmas) para o mapa continuar legível, agregando o resto em
// "Outras turmas".
function computeHeatmapData(rows, maxCols = 8) {
  const colMap = new Map();
  let hasOutroBloco = false;

  rows.forEach((r) => {
    const bloco = PDF_BLOCOS_HORARIO.includes(r.bloco_horario)
      ? r.bloco_horario
      : "__outro__";
    if (bloco === "__outro__") hasOutroBloco = true;
    const turmaLabel = r.turma
      ? r.ano
        ? `${r.ano}.º ${r.turma}`
        : r.turma
      : "Sem turma";
    if (!colMap.has(turmaLabel)) {
      colMap.set(turmaLabel, { label: turmaLabel, total: 0, counts: new Map() });
    }
    const col = colMap.get(turmaLabel);
    col.total += 1;
    col.counts.set(bloco, (col.counts.get(bloco) || 0) + 1);
  });

  const blocoKeys = [...PDF_BLOCOS_HORARIO];
  if (hasOutroBloco) blocoKeys.push("__outro__");
  const blocoLabels = blocoKeys.map((b) =>
    b === "__outro__" ? "Outro / sem bloco" : b,
  );

  let cols = [...colMap.values()].sort((a, b) => b.total - a.total);
  if (cols.length > maxCols) {
    const kept = cols.slice(0, maxCols);
    const rest = cols.slice(maxCols);
    const outras = { label: "Outras turmas", total: 0, counts: new Map() };
    rest.forEach((c) => {
      outras.total += c.total;
      c.counts.forEach((v, k) => outras.counts.set(k, (outras.counts.get(k) || 0) + v));
    });
    cols = kept.concat([outras]);
  }

  const matrix = blocoKeys.map((bloco) => cols.map((c) => c.counts.get(bloco) || 0));
  const rowTotals = matrix.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals = cols.map((c) => c.total);
  const maxVal = Math.max(1, ...matrix.flat());

  return {
    blocoLabels,
    colLabels: cols.map((c) => c.label),
    matrix,
    rowTotals,
    colTotals,
    maxVal,
  };
}

// Conta ocorrências por motivo (texto exato), do mais para o menos
// frequente, agregando a "cauda longa" em "Outros motivos".
function computeMotivoData(rows, maxItems = 10) {
  const counts = new Map();
  rows.forEach((r) => {
    const motivo = String(r.motivo || "").trim() || "Sem motivo";
    counts.set(motivo, (counts.get(motivo) || 0) + 1);
  });
  let entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length > maxItems) {
    const kept = entries.slice(0, maxItems);
    const restTotal = entries
      .slice(maxItems)
      .reduce((s, [, c]) => s + c, 0);
    kept.push(["Outros motivos", restTotal]);
    entries = kept;
  }
  return entries;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getRowDateStr(r) {
  return r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
}

// Segunda-feira a domingo da semana corrente (semana civil), não os
// últimos 7 dias — é o agrupamento usado no relatório PDF.
function getCurrentWeekRange() {
  const today = new Date();
  const day = today.getDay(); // 0 = domingo
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

// Renderiza o mapa de calor bloco horário x turma como tabela HTML, com a
// mesma lógica de agregação/cor do mapa desenhado no relatório PDF
// (computeHeatmapData + pdfHeatColor).
function renderHeatmapTable(containerId, rows, emptyMessage) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `<div class="heatmap-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const { blocoLabels, colLabels, matrix, rowTotals, colTotals, maxVal } =
    computeHeatmapData(rows);

  const theadCols = colLabels
    .map((label) => `<th>${escapeHtml(label)}</th>`)
    .join("");

  const bodyRows = blocoLabels
    .map((label, rIdx) => {
      const cells = matrix[rIdx]
        .map((val) => {
          const t = val / maxVal;
          const [r, g, b] = pdfHeatColor(t);
          const [tr, tg, tb] = pdfPickTextColor(r, g, b);
          return `<td class="heatmap-cell" style="background: rgb(${r}, ${g}, ${b}); color: rgb(${tr}, ${tg}, ${tb})">${val || ""}</td>`;
        })
        .join("");
      return `<tr><th class="heatmap-row-label">${escapeHtml(label)}</th>${cells}<td class="heatmap-total-cell">${rowTotals[rIdx]}</td></tr>`;
    })
    .join("");

  const totalRow = `<tr class="heatmap-total-row"><th>Total</th>${colTotals
    .map((v) => `<td>${v}</td>`)
    .join("")}<td>${rows.length}</td></tr>`;

  el.innerHTML = `
    <div class="heatmap-scroll">
      <table class="heatmap-table">
        <thead><tr><th>Bloco horário</th>${theadCols}<th>Total</th></tr></thead>
        <tbody>${bodyRows}${totalRow}</tbody>
      </table>
    </div>
  `;
}

// Aplica apenas os filtros de ano/turma do Dashboard (não o período), já
// que o mapa diário/semanal tem a sua própria janela de datas fixa.
function applyAnoTurmaFilter(rows) {
  const { ano, turma } = getDashboardFilters();
  return (rows || []).filter((r) => {
    if (ano && String(r.ano) !== ano) return false;
    if (turma && String(r.turma || r.alunos?.turma || "") !== turma)
      return false;
    return true;
  });
}

function renderOcorrenciasMaps(rows) {
  if (
    !document.getElementById("heatmapDaily") &&
    !document.getElementById("heatmapWeekly")
  ) {
    return;
  }

  const filtered = applyAnoTurmaFilter(rows);
  const todayStr = new Date().toISOString().slice(0, 10);
  const { start, end } = getCurrentWeekRange();

  const dailyRows = filtered.filter((r) => getRowDateStr(r) === todayStr);
  const weeklyRows = filtered.filter((r) => {
    const date = getRowDateStr(r);
    return date >= start && date <= end;
  });

  renderHeatmapTable(
    "heatmapDaily",
    dailyRows,
    "Sem ocorrências registadas hoje.",
  );
  renderHeatmapTable(
    "heatmapWeekly",
    weeklyRows,
    "Sem ocorrências registadas esta semana.",
  );
}

function drawHeatLegend(doc, x, y, width) {
  const steps = 40;
  const stepWidth = width / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const [r, g, b] = pdfHeatColor(t);
    doc.setFillColor(r, g, b);
    doc.rect(x + i * stepWidth, y, stepWidth + 0.5, 8, "F");
  }
  doc.setFontSize(7);
  doc.setTextColor(82, 81, 78);
  doc.text("Menos ocorrências", x, y + 16);
  doc.text("Mais ocorrências", x + width, y + 16, { align: "right" });
}

// Desenha o mapa de calor bloco horário x turma e devolve o Y seguinte.
function drawHeatmapSection(doc, startY, heatData) {
  const { blocoLabels, colLabels, matrix, rowTotals, colTotals, maxVal } = heatData;
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - PDF_PAGE_MARGIN * 2;
  const rowLabelWidth = 85;
  const totalColWidth = 38;
  const numDataCols = Math.max(1, colLabels.length);
  const colWidth = Math.max(
    26,
    (usableWidth - rowLabelWidth - totalColWidth) / numDataCols,
  );
  const headerHeight = 28;
  const rowHeight = 15;
  const legendHeight = 20;
  const titleHeight = 16;
  const totalRowsCount = blocoLabels.length + 1;
  const neededHeight =
    titleHeight + legendHeight + headerHeight + totalRowsCount * rowHeight + 14;

  let y = pdfEnsureSpace(doc, startY, neededHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(11, 11, 11);
  doc.text("Ocorrências por Bloco Horário e Turma", PDF_PAGE_MARGIN, y + 10);
  doc.setFont("helvetica", "normal");
  y += titleHeight + 4;

  drawHeatLegend(doc, PDF_PAGE_MARGIN, y, 160);
  y += legendHeight;

  let x = PDF_PAGE_MARGIN;
  doc.setFontSize(7);

  doc.setFillColor(245, 245, 243);
  doc.rect(x, y, rowLabelWidth, headerHeight, "F");
  doc.setTextColor(82, 81, 78);
  doc.text("Bloco horário", x + 4, y + headerHeight / 2 + 2);
  x += rowLabelWidth;

  colLabels.forEach((label) => {
    doc.setFillColor(245, 245, 243);
    doc.rect(x, y, colWidth, headerHeight, "F");
    const lines = doc.splitTextToSize(label, colWidth - 4).slice(0, 2);
    doc.text(lines, x + colWidth / 2, y + 10, { align: "center" });
    x += colWidth;
  });

  doc.setFillColor(238, 237, 230);
  doc.rect(x, y, totalColWidth, headerHeight, "F");
  doc.setTextColor(82, 81, 78);
  doc.text("Total", x + totalColWidth / 2, y + headerHeight / 2 + 2, {
    align: "center",
  });
  y += headerHeight;

  blocoLabels.forEach((blocoLabel, rIdx) => {
    x = PDF_PAGE_MARGIN;
    doc.setFillColor(252, 252, 251);
    doc.rect(x, y, rowLabelWidth, rowHeight, "F");
    doc.setFontSize(7);
    doc.setTextColor(11, 11, 11);
    doc.text(blocoLabel, x + 4, y + rowHeight / 2 + 2);
    x += rowLabelWidth;

    matrix[rIdx].forEach((val) => {
      const t = val / maxVal;
      const [r, g, b] = pdfHeatColor(t);
      doc.setFillColor(r, g, b);
      doc.rect(x, y, colWidth, rowHeight, "F");
      const [tr, tg, tb] = pdfPickTextColor(r, g, b);
      doc.setTextColor(tr, tg, tb);
      doc.setFontSize(7.5);
      doc.text(String(val), x + colWidth / 2, y + rowHeight / 2 + 2, {
        align: "center",
      });
      x += colWidth;
    });

    doc.setFillColor(238, 237, 230);
    doc.rect(x, y, totalColWidth, rowHeight, "F");
    doc.setTextColor(11, 11, 11);
    doc.setFontSize(7.5);
    doc.text(String(rowTotals[rIdx]), x + totalColWidth / 2, y + rowHeight / 2 + 2, {
      align: "center",
    });
    y += rowHeight;
  });

  x = PDF_PAGE_MARGIN;
  doc.setFillColor(230, 229, 222);
  doc.setFont("helvetica", "bold");
  doc.rect(x, y, rowLabelWidth, rowHeight, "F");
  doc.setFontSize(7.5);
  doc.setTextColor(11, 11, 11);
  doc.text("Total", x + 4, y + rowHeight / 2 + 2);
  x += rowLabelWidth;

  colTotals.forEach((val) => {
    doc.setFillColor(230, 229, 222);
    doc.rect(x, y, colWidth, rowHeight, "F");
    doc.text(String(val), x + colWidth / 2, y + rowHeight / 2 + 2, {
      align: "center",
    });
    x += colWidth;
  });

  const grandTotal = colTotals.reduce((s, v) => s + v, 0);
  doc.setFillColor(222, 221, 212);
  doc.rect(x, y, totalColWidth, rowHeight, "F");
  doc.text(String(grandTotal), x + totalColWidth / 2, y + rowHeight / 2 + 2, {
    align: "center",
  });
  doc.setFont("helvetica", "normal");
  y += rowHeight;

  return y + 14;
}

// Desenha o gráfico de barras "ocorrências por motivo" e devolve o Y seguinte.
function drawMotivoChartSection(doc, startY, entries) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - PDF_PAGE_MARGIN * 2;
  const labelWidth = 170;
  const valueWidth = 30;
  const barAreaWidth = usableWidth - labelWidth - valueWidth;
  const barHeight = 11;
  const rowGap = 7;
  const lineHeight = 9;
  const titleHeight = 18;

  doc.setFontSize(8.5);
  const rows = entries.map(([label, count]) => {
    const lines = doc.splitTextToSize(label, labelWidth - 6);
    const h = Math.max(barHeight, lines.length * lineHeight) + rowGap;
    return { lines, count, h };
  });
  const neededHeight = titleHeight + rows.reduce((s, r) => s + r.h, 0) + 10;

  let y = pdfEnsureSpace(doc, startY, neededHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(11, 11, 11);
  doc.text("Ocorrências por Motivo", PDF_PAGE_MARGIN, y + 10);
  doc.setFont("helvetica", "normal");
  y += titleHeight;

  const maxCount = Math.max(1, ...entries.map(([, c]) => c));
  const barColor = [42, 120, 214]; // azul sequencial do design system

  rows.forEach(({ lines, count, h }) => {
    doc.setFontSize(8.5);
    doc.setTextColor(11, 11, 11);
    doc.text(lines, PDF_PAGE_MARGIN, y + lineHeight);

    const barWidth = Math.max(2, (count / maxCount) * barAreaWidth);
    doc.setFillColor(barColor[0], barColor[1], barColor[2]);
    doc.roundedRect(PDF_PAGE_MARGIN + labelWidth, y, barWidth, barHeight, 2, 2, "F");

    doc.setTextColor(82, 81, 78);
    doc.text(String(count), PDF_PAGE_MARGIN + labelWidth + barWidth + 4, y + barHeight - 2);

    y += h;
  });

  return y + 10;
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
      updateSubmitState();
    }
    if (motivoSelect) {
      motivoSelect.addEventListener("change", updateMotivoFromSelect);
      updateMotivoFromSelect();
    }

    // Only allow "Gravar Ocorrência" once aluno, data, bloco horário e
    // motivo estão todos preenchidos.
    const submitBtn = form.querySelector("button[type=submit]");
    const requiredIds = ["alunoSelect", "data", "blocoHorario", "motivo"];
    function updateSubmitState() {
      if (!submitBtn) return;
      const filled = requiredIds.every((id) => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== "";
      });
      submitBtn.disabled = !filled;
    }
    requiredIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", updateSubmitState);
        el.addEventListener("change", updateSubmitState);
      }
    });
    updateSubmitState();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alunoSelectEl = document.getElementById("alunoSelect");
      const anoEl = document.getElementById("ano");
      const turmaEl = document.getElementById("turma");
      const motivoEl = document.getElementById("motivo");
      const dataEl = document.getElementById("data");
      const blocoHorarioEl = document.getElementById("blocoHorario");
      const submitBtn = form.querySelector("button[type=submit]");
      const selectedAluno =
        alunoSelectEl?.options[alunoSelectEl.selectedIndex] || null;
      // The chosen aluno (whether found via free-text search or via the
      // ciclo/ano/turma cascade) is the source of truth for ano/turma —
      // this works regardless of which path was used to find them.
      const anoFinal = selectedAluno?.dataset?.ano
        ? Number(selectedAluno.dataset.ano)
        : anoEl?.value
          ? Number(anoEl.value)
          : null;
      const turmaFinal =
        selectedAluno?.dataset?.turma || turmaEl?.value?.trim() || null;
      const selectedTurma = registarTurmasCache.find(
        (t) => String(t.ano) === String(anoFinal) && t.nome === turmaFinal,
      );

      const dados = {
        aluno_id: selectedAluno?.dataset?.id || null,
        aluno_nome: alunoSelectEl ? alunoSelectEl.value.trim() : "",
        ano: anoFinal,
        turma: turmaFinal,
        diretor_turma: selectedTurma?.diretor_turma || null,
        data: dataEl ? dataEl.value : new Date().toISOString().slice(0, 10),
        bloco_horario: blocoHorarioEl ? blocoHorarioEl.value : "",
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

  const frequentMotivoFilterEl = document.getElementById(
    "frequentStudentsMotivoFilter",
  );
  if (frequentMotivoFilterEl) {
    frequentMotivoFilterEl.addEventListener("change", () => {
      renderFrequentStudents(lastDisplayRows);
    });
  }

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

  if (ocorrenciasListEl) {
    ocorrenciasListEl.addEventListener("click", (event) => {
      const btn = event.target.closest(".delete-ocorrencia-btn");
      if (!btn) return;
      window.setTimeout(async () => {
        const ok = confirm("Eliminar esta ocorrência?");
        if (!ok) return;
        btn.disabled = true;
        try {
          await eliminarOcorrencia({
            id: btn.dataset.id,
            localIndex: btn.dataset.localIndex,
            searchQuery: search?.value.trim() || "",
          });
        } finally {
          if (btn.isConnected) btn.disabled = false;
        }
      }, 0);
    });
  }

  // Edit popup wired to #editOcorrenciaDialog — present only on the
  // dashboard (index.html), next to the "Ocorrências Recentes" list.
  const editDialog = document.getElementById("editOcorrenciaDialog");
  if (editDialog && ocorrenciasListEl) {
    const editForm = document.getElementById("editOcorrenciaForm");
    const editDataEl = document.getElementById("editData");
    const editBlocoEl = document.getElementById("editBlocoHorario");
    const editMotivoSelectEl = document.getElementById("editMotivoSelect");
    const editMotivoEl = document.getElementById("editMotivo");
    const editCancelBtn = document.getElementById("editOcorrenciaCancel");
    const MOTIVO_PRESETS = ["Chegou atrasado", "Comportamento desadequado"];

    function updateEditMotivoReadOnly() {
      const isPreset = MOTIVO_PRESETS.includes(editMotivoSelectEl.value);
      if (isPreset) editMotivoEl.value = editMotivoSelectEl.value;
      editMotivoEl.readOnly = isPreset;
    }
    editMotivoSelectEl.addEventListener("change", updateEditMotivoReadOnly);

    ocorrenciasListEl.addEventListener("click", (event) => {
      const btn = event.target.closest(".edit-ocorrencia-btn");
      if (!btn) return;
      const row = findDisplayRow({
        id: btn.dataset.id,
        localIndex: btn.dataset.localIndex,
      });
      if (!row) {
        alert("Não foi possível carregar esta ocorrência para edição.");
        return;
      }

      editForm.dataset.id = row.id || "";
      editForm.dataset.localIndex =
        row._local && row._pendingIndex !== undefined
          ? String(row._pendingIndex)
          : "";

      editDataEl.value =
        row.data ||
        (row.created_at ? row.created_at.slice(0, 10) : "");
      editBlocoEl.value = row.bloco_horario || "";
      editMotivoEl.value = row.motivo || "";
      editMotivoSelectEl.value = MOTIVO_PRESETS.includes(row.motivo)
        ? row.motivo
        : "Outro";
      updateEditMotivoReadOnly();

      editDialog.showModal();
    });

    if (editCancelBtn) {
      editCancelBtn.addEventListener("click", () => editDialog.close());
    }

    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = editForm.querySelector("button[type=submit]");
      const changes = {
        data: editDataEl.value,
        bloco_horario: editBlocoEl.value,
        motivo: editMotivoEl.value.trim(),
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "A guardar…";
      }
      try {
        const ok = await editarOcorrencia({
          id: editForm.dataset.id || null,
          localIndex: editForm.dataset.localIndex || "",
          changes,
          searchQuery: search?.value.trim() || "",
        });
        if (ok) editDialog.close();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Guardar";
        }
      }
    });
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

      const occurrences = data || [];

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
      let tableStartY = 120;
      if (start || end) {
        doc.text(
          `Período: ${start || "início"} a ${end || "fim"}`,
          40,
          114,
        );
        tableStartY = 134;
      }

      if (!occurrences.length) {
        doc.setFontSize(11);
        doc.setTextColor(82, 81, 78);
        doc.text(
          "Nenhuma ocorrência encontrada para os filtros selecionados.",
          40,
          tableStartY + 10,
        );
      } else {
        // Tabela agrupada por aluno: o nome aparece uma única vez (coluna
        // com rowSpan) seguido das respetivas ocorrências.
        const groupedBody = buildGroupedReportBody(occurrences);
        doc.autoTable({
          startY: tableStartY,
          margin: { top: 40, bottom: 40 },
          head: [["Aluno", "Data", "Bloco Horário", "Motivo"]],
          body: groupedBody,
          styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
          headStyles: { fillColor: [30, 60, 120] },
          columnStyles: { 0: { cellWidth: 150 } },
        });

        let y = (doc.lastAutoTable?.finalY || tableStartY) + 24;
        const heatData = computeHeatmapData(occurrences);
        y = drawHeatmapSection(doc, y, heatData);

        const motivoData = computeMotivoData(occurrences);
        drawMotivoChartSection(doc, y, motivoData);
      }

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
