import type { StrategyReport } from "./build-report";

function section(title: string, body: string | null | undefined): string {
  if (!body || !body.trim()) return "";
  return `## ${title}\n\n${body.trim()}\n\n`;
}

/** Serializuje raport strategii do Markdown (spec: eksport MD/DOCX). */
export function reportToMarkdown(r: StrategyReport): string {
  let md = `# Strategia — ${r.projectName}\n\n`;
  md += `_Wygenerowano: ${new Date(r.generatedAt).toLocaleString("pl-PL")}_\n\n`;

  md += section("Cele biznesowe", r.goalsMd);
  md += section("UVP (Unique Value Proposition)", r.uvpMd);

  if (r.positioning) {
    md += `## Pozycjonowanie\n\n`;
    if (r.positioning.axisXLabel || r.positioning.axisYLabel) {
      md += `Osie: ${r.positioning.axisXLabel ?? "?"} × ${r.positioning.axisYLabel ?? "?"}\n\n`;
    }
    if (r.positioning.statementMd) md += `${r.positioning.statementMd.trim()}\n\n`;
  }

  if (r.competitors.length > 0) {
    md += `## Konkurencja\n\n`;
    for (const c of r.competitors) {
      md += `### ${c.name} (${c.type})\n\n`;
      if (c.strengthsMd) md += `**Mocne strony:** ${c.strengthsMd}\n\n`;
      if (c.weaknessesMd) md += `**Słabe strony:** ${c.weaknessesMd}\n\n`;
    }
  }

  if (r.segments.length > 0) {
    md += `## Segmenty\n\n`;
    for (const s of r.segments) {
      md += `### ${s.name}${s.personaName ? ` — ${s.personaName}` : ""}${
        s.priority != null ? ` (priorytet ${s.priority})` : ""
      }\n\n`;
      if (s.jtbdMd) md += `**JTBD:** ${s.jtbdMd}\n\n`;
      if (s.problemMd) md += `**Problem:** ${s.problemMd}\n\n`;
      if (s.uvpForSegmentMd) md += `**UVP dla segmentu:** ${s.uvpForSegmentMd}\n\n`;
    }
  }

  if (r.funnel.length > 0) {
    md += `## Lejek\n\n`;
    for (const stage of r.funnel) {
      md += `### ${stage.stageName}${stage.phase ? ` (${stage.phase})` : ""}\n\n`;
      for (const el of stage.elements) {
        md += `- **${el.name}** ${el.format ? `— ${el.format} ` : ""}${
          el.status ? `_(${el.status})_` : ""
        }\n`;
      }
      md += `\n`;
    }
  }

  if (r.channels.length > 0) {
    md += `## Kanały\n\n`;
    for (const c of r.channels) {
      md += `- **${c.name}** ${c.type ? `(${c.type})` : ""} — ${c.status ?? "?"}${
        c.costMonthly != null ? `, ${c.costMonthly} zł/mc` : ""
      }\n`;
    }
    md += `\n`;
  }

  if (r.kpis.length > 0) {
    md += `## KPI\n\n`;
    for (const k of r.kpis) {
      md += `- **${k.name}:** ${k.actual ?? "—"} / ${k.target ?? "—"} ${k.unit ?? ""}\n`;
    }
    md += `\n`;
  }

  if (r.objections.length > 0) {
    md += `## Obiekcje\n\n`;
    for (const o of r.objections) {
      md += `- **Obiekcja:** ${o.objectionMd} _(${o.status})_\n`;
      if (o.responseMd) md += `  **Odpowiedź:** ${o.responseMd}\n`;
    }
    md += `\n`;
  }

  return md;
}
