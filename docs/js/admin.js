async function loadCiclos() {
  const el = document.getElementById("turmaCiclo");
  if (!el) return;
  el.innerHTML = '<option value="">Carregando...</option>';
  const { data, error } = await window.supabase
    .from("ciclos")
    .select("*")
    .order("nome");
  if (error) {
    el.innerHTML = '<option value="">Erro</option>';
    return;
  }
  el.innerHTML =
    '<option value="">-- seleccionar --</option>' +
    (data || [])
      .map((c) => `<option value="${c.id}">${c.nome}</option>`)
      .join("");
}

async function refreshTurmas() {
  const el = document.getElementById("turmasList");
  if (!el) return;
  el.innerHTML = "Carregando...";
  const { data, error } = await window.supabase
    .from("turmas")
    .select("*, ciclos(*)")
    .order("nome");
  if (error)
    return (el.innerHTML = "Erro ao carregar turmas: " + error.message);
  el.innerHTML = (data || [])
    .map(
      (t) =>
        `<div class="p-2 border mb-1">${t.nome} (Ano ${t.ano || ""}) — Ciclo: ${t.ciclos?.nome || ""}</div>`,
    )
    .join("");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.supabaseReady) await window.supabaseReady;
  await loadCiclos();
  await refreshTurmas();

  document.getElementById("createCiclo").addEventListener("click", async () => {
    const nome = document.getElementById("cicloNome").value.trim();
    if (!nome) return alert("Nome do ciclo é obrigatório");
    const { error } = await window.supabase.from("ciclos").insert([{ nome }]);
    if (error) return alert("Erro a criar ciclo: " + error.message);
    document.getElementById("cicloNome").value = "";
    await loadCiclos();
    alert("Ciclo criado");
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
    await refreshTurmas();
    alert("Turma criada");
  });

  document.getElementById("importCsv").addEventListener("click", async () => {
    const f = document.getElementById("csvFile").files[0];
    if (!f) return alert("Selecciona um ficheiro CSV");
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
        document.getElementById("importStatus").textContent =
          "A inserir " + rows.length + " alunos...";
        // bulk insert in batches
        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const slice = rows.slice(i, i + batchSize);
          const { error } = await window.supabase.from("alunos").insert(slice);
          if (error) return alert("Erro na importação: " + error.message);
        }
        document.getElementById("importStatus").textContent =
          "Importação concluída: " + rows.length + " alunos";
        await refreshTurmas();
      },
    });
  });
});
