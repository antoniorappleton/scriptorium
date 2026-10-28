import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface Ocorrencia {
  aluno_nome: string | null;
  data: string | null;
  created_at: string | null;
  bloco_horario: string | null;
  motivo: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return json({ error: "Não autorizado." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !sendgridApiKey) {
    return json({ error: "Secrets em falta na Edge Function." }, 500);
  }

  const db = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);
  const period = url.searchParams.get("period") === "monthly" ? "monthly" : "weekly";
  const dryRun = url.searchParams.get("dryRun") === "true";
  const testRecipient = url.searchParams.get("testRecipient");
  const { start, end } = resolveDateRange(
    period,
    url.searchParams.get("start"),
    url.searchParams.get("end"),
  );

  const { data: turmas, error: turmasError } = await db
    .from("turmas")
    .select("id, nome, ano, dt_professor_id, professores!dt_professor_id (nome, email)")
    .not("dt_professor_id", "is", null);

  if (turmasError) {
    return json({ error: turmasError.message }, 500);
  }

  const results: Array<Record<string, unknown>> = [];

  for (const turma of turmas || []) {
    const professor = (turma as any).professores as { nome: string; email: string } | null;
    if (!professor?.email) {
      results.push({ turma: turma.nome, ano: turma.ano, status: "skipped", motivo: "sem_email_dt" });
      continue;
    }

    const { data: ocorrencias, error: ocorrenciasError } = await db
      .from("ocorrencias")
      .select("aluno_nome, data, created_at, bloco_horario, motivo")
      .eq("turma", turma.nome)
      .eq("ano", turma.ano)
      .gte("data", start)
      .lte("data", end)
      .order("data", { ascending: false });

    if (ocorrenciasError) {
      results.push({ turma: turma.nome, ano: turma.ano, status: "erro", erro: ocorrenciasError.message });
      if (!dryRun) await logRelatorio(db, { period, turma, start, end, professor, count: 0, status: "erro", erro: ocorrenciasError.message });
      continue;
    }

    const rows = ocorrencias || [];
    if (rows.length === 0) {
      results.push({ turma: turma.nome, ano: turma.ano, status: "skipped", motivo: "sem_ocorrencias" });
      continue;
    }

    if (dryRun) {
      results.push({
        turma: turma.nome,
        ano: turma.ano,
        status: "dry_run",
        destinatario: testRecipient || professor.email,
        ocorrencias_count: rows.length,
      });
      continue;
    }

    try {
      const pdfBytes = await buildReportPdf({
        turma: turma.nome,
        ano: turma.ano,
        diretorTurma: professor.nome,
        period,
        start,
        end,
        rows,
      });

      await sendReportEmail({
        apiKey: sendgridApiKey,
        to: testRecipient || professor.email,
        turma: turma.nome,
        period,
        start,
        end,
        pdfBytes,
      });

      results.push({ turma: turma.nome, ano: turma.ano, status: "enviado", ocorrencias_count: rows.length });
      await logRelatorio(db, { period, turma, start, end, professor, count: rows.length, status: "enviado" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ turma: turma.nome, ano: turma.ano, status: "erro", erro: message });
      await logRelatorio(db, { period, turma, start, end, professor, count: rows.length, status: "erro", erro: message });
    }
  }

  const sent = results.filter((r) => r.status === "enviado").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "erro").length;

  return json({ period, start, end, dryRun, sent, skipped, errors, results });
});

// Segunda a domingo (semanal) ou mês civil (mensal) IMEDIATAMENTE ANTERIOR
// à data de execução. Permite override manual via start/end para testes.
function resolveDateRange(period: "weekly" | "monthly", startOverride: string | null, endOverride: string | null) {
  if (startOverride && endOverride) {
    return { start: startOverride, end: endOverride };
  }

  const now = new Date();
  if (period === "monthly") {
    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const start = new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth() - 1, 1);
    const end = new Date(firstOfThisMonth.getFullYear(), firstOfThisMonth.getMonth(), 0);
    return { start: toIsoDate(start), end: toIsoDate(end) };
  }

  const day = now.getDay(); // 0 = domingo
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  return { start: toIsoDate(lastMonday), end: toIsoDate(lastSunday) };
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function logRelatorio(
  db: ReturnType<typeof createClient>,
  opts: {
    period: string;
    turma: { nome: string; ano: number | null };
    start: string;
    end: string;
    professor: { email: string } | null;
    count: number;
    status: "enviado" | "erro";
    erro?: string;
  },
) {
  await db.from("relatorios_log").insert({
    periodo: opts.period,
    turma: opts.turma.nome,
    ano: opts.turma.ano,
    professor_email: opts.professor?.email || null,
    data_inicio: opts.start,
    data_fim: opts.end,
    ocorrencias_count: opts.count,
    status: opts.status,
    erro: opts.erro || null,
  });
}

// Agrupa ocorrências por aluno (mesma ordenação usada no PDF manual do
// painel admin: app/js/app.js#buildGroupedReportBody), e conta por motivo
// (app/js/app.js#computeMotivoData).
function groupByAluno(rows: Ocorrencia[]) {
  const sorted = [...rows].sort((a, b) => {
    const nameCompare = String(a.aluno_nome || "").localeCompare(String(b.aluno_nome || ""), "pt", { sensitivity: "base" });
    if (nameCompare !== 0) return nameCompare;
    return String(b.data || "").localeCompare(String(a.data || ""));
  });
  return sorted;
}

function countByMotivo(rows: Ocorrencia[], maxItems = 10) {
  const counts = new Map<string, number>();
  rows.forEach((r) => {
    const motivo = String(r.motivo || "").trim() || "Sem motivo";
    counts.set(motivo, (counts.get(motivo) || 0) + 1);
  });
  let entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length > maxItems) {
    const kept = entries.slice(0, maxItems);
    const restTotal = entries.slice(maxItems).reduce((s, [, c]) => s + c, 0);
    kept.push(["Outros motivos", restTotal]);
    entries = kept;
  }
  return entries;
}

async function buildReportPdf(opts: {
  turma: string;
  ano: number | null;
  diretorTurma: string;
  period: "weekly" | "monthly";
  start: string;
  end: string;
  rows: Ocorrencia[];
}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 em pt
  const pageHeight = 841.89;
  const margin = 40;
  const lineHeight = 14;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function ensureSpace(needed: number) {
    if (y - needed < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  }

  function drawLine(text: string, opts2: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) {
    ensureSpace(lineHeight);
    page.drawText(text, {
      x: margin,
      y,
      size: opts2.size || 10,
      font: opts2.bold ? fontBold : font,
      color: opts2.color || rgb(0.1, 0.1, 0.1),
    });
    y -= lineHeight;
  }

  const periodoLabel = opts.period === "weekly" ? "Relatório Semanal" : "Relatório Mensal";
  drawLine("SCRIPTORIUM", { bold: true, size: 16 });
  drawLine(`${periodoLabel} de Ocorrências`, { bold: true, size: 12 });
  y -= 4;
  drawLine(`Turma: ${opts.ano ? `${opts.ano}.º ${opts.turma}` : opts.turma}`);
  drawLine(`Diretor de Turma: ${opts.diretorTurma}`);
  drawLine(`Período: ${opts.start} a ${opts.end}`);
  y -= 8;

  const grouped = groupByAluno(opts.rows);

  const colX = { aluno: margin, data: margin + 170, bloco: margin + 250, motivo: margin + 340 };
  ensureSpace(lineHeight);
  page.drawText("Aluno", { x: colX.aluno, y, size: 9, font: fontBold });
  page.drawText("Data", { x: colX.data, y, size: 9, font: fontBold });
  page.drawText("Bloco", { x: colX.bloco, y, size: 9, font: fontBold });
  page.drawText("Motivo", { x: colX.motivo, y, size: 9, font: fontBold });
  y -= lineHeight;
  ensureSpace(1);
  page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: pageWidth - margin, y: y + 4 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

  grouped.forEach((r) => {
    ensureSpace(lineHeight);
    const dataFmt = r.data || (r.created_at ? r.created_at.slice(0, 10) : "");
    const alunoNome = truncate(r.aluno_nome || "(sem nome)", 32);
    const motivo = truncate(r.motivo || "", 36);
    page.drawText(alunoNome, { x: colX.aluno, y, size: 8.5, font });
    page.drawText(dataFmt, { x: colX.data, y, size: 8.5, font });
    page.drawText(r.bloco_horario || "", { x: colX.bloco, y, size: 8.5, font });
    page.drawText(motivo, { x: colX.motivo, y, size: 8.5, font });
    y -= lineHeight;
  });

  y -= 10;
  ensureSpace(lineHeight);
  drawLine("Ocorrências por Motivo", { bold: true, size: 11 });
  const motivoCounts = countByMotivo(opts.rows);
  motivoCounts.forEach(([motivo, count]) => {
    drawLine(`• ${motivo}: ${count}`);
  });

  return doc.save();
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function sendReportEmail(opts: {
  apiKey: string;
  to: string;
  turma: string;
  period: "weekly" | "monthly";
  start: string;
  end: string;
  pdfBytes: Uint8Array;
}) {
  const periodoLabel = opts.period === "weekly" ? "semanal" : "mensal";
  const filename = `relatorio_${opts.period}_${opts.turma}_${opts.start}_a_${opts.end}.pdf`;
  const base64Pdf = encodeBase64(opts.pdfBytes);

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: opts.to }] }],
      from: { email: "antonio.appleton@colegio-ramalhao.com", name: "Scriptorium" },
      subject: `Relatório ${periodoLabel} de ocorrências — Turma ${opts.turma} (${opts.start} a ${opts.end})`,
      content: [
        {
          type: "text/plain",
          value: `Segue em anexo o relatório ${periodoLabel} de ocorrências da turma ${opts.turma}, referente ao período de ${opts.start} a ${opts.end}.`,
        },
      ],
      attachments: [
        {
          content: base64Pdf,
          filename,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SendGrid respondeu ${res.status}: ${body}`);
  }
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
