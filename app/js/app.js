async function registarOcorrencia(dados) {
  try {
    const { error } = await window.supabase.from("ocorrencias").insert([dados]);
    if (error) throw error;
    alert("Registo feito!");
    carregarOcorrencias();
  } catch (err) {
    console.warn("Envio falhou — guardando localmente", err.message);
    const pendentes = JSON.parse(localStorage.getItem("pendentes") || "[]");
    pendentes.push(dados);
    localStorage.setItem("pendentes", JSON.stringify(pendentes));
    alert(
      'Sem ligação — registo guardado localmente. Use "Sincronizar pendentes" quando tiver internet.',
    );
    carregarOcorrencias();
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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("ocorrenciaForm");
  const syncBtn = document.getElementById("syncBtn");
  const search = document.getElementById("search");

  document.getElementById("data").value = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const dados = {
      aluno_nome: document.getElementById("alunoNome").value,
      ano: Number(document.getElementById("ano").value),
      turma: document.getElementById("turma").value,
      data: document.getElementById("data").value,
      motivo: document.getElementById("motivo").value,
      created_at: new Date().toISOString(),
    };
    registarOcorrencia(dados);
    form.reset();
    document.getElementById("data").value = new Date()
      .toISOString()
      .slice(0, 10);
  });

  syncBtn.addEventListener("click", () => sincronizarPendentes());

  let debounce;
  search.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => carregarOcorrencias(search.value.trim()), 300);
  });

  carregarOcorrencias();
});
