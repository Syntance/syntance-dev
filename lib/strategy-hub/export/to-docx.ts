import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
} from "docx";
import type { StrategyReport } from "./build-report";

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } });
}

function p(text: string) {
  return new Paragraph({ children: [new TextRun(text)], spacing: { after: 120 } });
}

function bold(label: string, value: string) {
  return new Paragraph({
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)],
    spacing: { after: 80 },
  });
}

function bullet(text: string) {
  return new Paragraph({ text, bullet: { level: 0 }, spacing: { after: 40 } });
}

/** Serializuje raport strategii do dokumentu DOCX (buffer gotowy do wysyłki/pobrania). */
export async function reportToDocx(r: StrategyReport): Promise<Buffer> {
  const children: Paragraph[] = [
    h(`Strategia — ${r.projectName}`, HeadingLevel.TITLE),
    p(`Wygenerowano: ${new Date(r.generatedAt).toLocaleString("pl-PL")}`),
  ];

  if (r.goalsMd) {
    children.push(h("Cele biznesowe", HeadingLevel.HEADING_1), p(r.goalsMd));
  }
  if (r.uvpMd) {
    children.push(h("UVP", HeadingLevel.HEADING_1), p(r.uvpMd));
  }
  if (r.positioning) {
    children.push(h("Pozycjonowanie", HeadingLevel.HEADING_1));
    if (r.positioning.axisXLabel || r.positioning.axisYLabel) {
      children.push(p(`Osie: ${r.positioning.axisXLabel ?? "?"} × ${r.positioning.axisYLabel ?? "?"}`));
    }
    if (r.positioning.statementMd) children.push(p(r.positioning.statementMd));
  }

  if (r.competitors.length > 0) {
    children.push(h("Konkurencja", HeadingLevel.HEADING_1));
    for (const c of r.competitors) {
      children.push(h(`${c.name} (${c.type})`, HeadingLevel.HEADING_2));
      if (c.strengthsMd) children.push(bold("Mocne strony", c.strengthsMd));
      if (c.weaknessesMd) children.push(bold("Słabe strony", c.weaknessesMd));
    }
  }

  if (r.segments.length > 0) {
    children.push(h("Segmenty", HeadingLevel.HEADING_1));
    for (const s of r.segments) {
      children.push(
        h(`${s.name}${s.personaName ? ` — ${s.personaName}` : ""}`, HeadingLevel.HEADING_2)
      );
      if (s.jtbdMd) children.push(bold("JTBD", s.jtbdMd));
      if (s.problemMd) children.push(bold("Problem", s.problemMd));
      if (s.uvpForSegmentMd) children.push(bold("UVP dla segmentu", s.uvpForSegmentMd));
    }
  }

  if (r.funnel.length > 0) {
    children.push(h("Lejek", HeadingLevel.HEADING_1));
    for (const stage of r.funnel) {
      children.push(h(`${stage.stageName}${stage.phase ? ` (${stage.phase})` : ""}`, HeadingLevel.HEADING_2));
      for (const el of stage.elements) {
        children.push(bullet(`${el.name}${el.format ? ` — ${el.format}` : ""}${el.status ? ` (${el.status})` : ""}`));
      }
    }
  }

  if (r.channels.length > 0) {
    children.push(h("Kanały", HeadingLevel.HEADING_1));
    for (const c of r.channels) {
      children.push(
        bullet(
          `${c.name}${c.type ? ` (${c.type})` : ""} — ${c.status ?? "?"}${
            c.costMonthly != null ? `, ${c.costMonthly} zł/mc` : ""
          }`
        )
      );
    }
  }

  if (r.kpis.length > 0) {
    children.push(h("KPI", HeadingLevel.HEADING_1));
    for (const k of r.kpis) {
      children.push(bullet(`${k.name}: ${k.actual ?? "—"} / ${k.target ?? "—"} ${k.unit ?? ""}`));
    }
  }

  if (r.objections.length > 0) {
    children.push(h("Obiekcje", HeadingLevel.HEADING_1));
    for (const o of r.objections) {
      children.push(bullet(`${o.objectionMd} (${o.status})`));
      if (o.responseMd) children.push(bullet(`↳ ${o.responseMd}`));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
