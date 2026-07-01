import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import type { StrategyReport } from "./build-report";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  cover: {
    padding: 40,
    fontFamily: "Helvetica",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  coverTitle: { fontSize: 30, fontWeight: 700, color: "#0a0a0a", textAlign: "center" },
  coverSubtitle: { fontSize: 13, color: "#6d28d9", marginTop: 10, textAlign: "center" },
  coverMeta: { fontSize: 10, color: "#999", marginTop: 40, textAlign: "center" },
  header: {
    borderBottom: "2 solid #6d28d9",
    paddingBottom: 12,
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: 700, color: "#0a0a0a" },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#6d28d9",
    marginBottom: 8,
    borderBottom: "1 solid #e5e5e5",
    paddingBottom: 4,
  },
  subheading: { fontSize: 11, fontWeight: 700, marginBottom: 3, marginTop: 8 },
  paragraph: { marginBottom: 6 },
  listItem: { marginBottom: 4 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999",
    borderTop: "1 solid #e5e5e5",
    paddingTop: 6,
  },
});

const el = React.createElement;

function paragraphs(md: string | null | undefined): React.ReactElement[] {
  if (!md?.trim()) return [];
  return md
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p, i) => el(Text, { key: i, style: styles.paragraph }, p.replace(/^#+\s+/, "")));
}

/**
 * Brandowany PDF pełnej strategii (spec: „PDF — pełna strategia": okładka, mapa
 * modułów, wszystkie sekcje). Kolejność sekcji spójna z `reportToMarkdown`.
 */
export async function reportToPdf(r: StrategyReport): Promise<Buffer> {
  const generated = new Date(r.generatedAt).toLocaleString("pl-PL");

  const sections: React.ReactElement[] = [];

  if (r.goalsMd) {
    sections.push(
      el(
        View,
        { key: "goals", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Cele biznesowe"),
        ...paragraphs(r.goalsMd)
      )
    );
  }

  if (r.uvpMd) {
    sections.push(
      el(
        View,
        { key: "uvp", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "UVP"),
        ...paragraphs(r.uvpMd)
      )
    );
  }

  if (r.positioning) {
    sections.push(
      el(
        View,
        { key: "positioning", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Pozycjonowanie"),
        r.positioning.axisXLabel || r.positioning.axisYLabel
          ? el(
              Text,
              { style: styles.paragraph },
              `Osie: ${r.positioning.axisXLabel ?? "?"} × ${r.positioning.axisYLabel ?? "?"}`
            )
          : null,
        ...paragraphs(r.positioning.statementMd)
      )
    );
  }

  if (r.competitors.length > 0) {
    sections.push(
      el(
        View,
        { key: "competitors", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Konkurencja"),
        ...r.competitors.flatMap((c, i) => [
          el(Text, { key: `n${i}`, style: styles.subheading }, `${c.name} (${c.type})`),
          c.strengthsMd
            ? el(Text, { key: `s${i}`, style: styles.paragraph }, `Mocne strony: ${c.strengthsMd}`)
            : null,
          c.weaknessesMd
            ? el(Text, { key: `w${i}`, style: styles.paragraph }, `Słabe strony: ${c.weaknessesMd}`)
            : null,
        ])
      )
    );
  }

  if (r.segments.length > 0) {
    sections.push(
      el(
        View,
        { key: "segments", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Segmenty"),
        ...r.segments.flatMap((s, i) => [
          el(
            Text,
            { key: `n${i}`, style: styles.subheading },
            `${s.name}${s.personaName ? ` — ${s.personaName}` : ""}${
              s.priority != null ? ` (priorytet ${s.priority})` : ""
            }`
          ),
          s.jtbdMd ? el(Text, { key: `j${i}`, style: styles.paragraph }, `JTBD: ${s.jtbdMd}`) : null,
          s.problemMd
            ? el(Text, { key: `p${i}`, style: styles.paragraph }, `Problem: ${s.problemMd}`)
            : null,
          s.uvpForSegmentMd
            ? el(Text, { key: `u${i}`, style: styles.paragraph }, `UVP: ${s.uvpForSegmentMd}`)
            : null,
        ])
      )
    );
  }

  if (r.funnel.length > 0) {
    sections.push(
      el(
        View,
        { key: "funnel", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Lejek"),
        ...r.funnel.flatMap((stage, i) => [
          el(
            Text,
            { key: `st${i}`, style: styles.subheading },
            `${stage.stageName}${stage.phase ? ` (${stage.phase})` : ""}`
          ),
          ...stage.elements.map((e, j) =>
            el(
              Text,
              { key: `el${i}-${j}`, style: styles.listItem },
              `• ${e.name}${e.format ? ` — ${e.format}` : ""}${e.status ? ` (${e.status})` : ""}`
            )
          ),
        ])
      )
    );
  }

  if (r.channels.length > 0) {
    sections.push(
      el(
        View,
        { key: "channels", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Kanały"),
        ...r.channels.map((c, i) =>
          el(
            Text,
            { key: i, style: styles.listItem },
            `• ${c.name}${c.type ? ` (${c.type})` : ""} — ${c.status ?? "?"}${
              c.costMonthly != null ? `, ${c.costMonthly} zł/mc` : ""
            }`
          )
        )
      )
    );
  }

  if (r.kpis.length > 0) {
    sections.push(
      el(
        View,
        { key: "kpis", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "KPI"),
        ...r.kpis.map((k, i) =>
          el(
            Text,
            { key: i, style: styles.listItem },
            `• ${k.name}: ${k.actual ?? "—"} / ${k.target ?? "—"} ${k.unit ?? ""}`
          )
        )
      )
    );
  }

  if (r.objections.length > 0) {
    sections.push(
      el(
        View,
        { key: "objections", style: styles.section, wrap: true },
        el(Text, { style: styles.sectionTitle }, "Obiekcje"),
        ...r.objections.flatMap((o, i) => [
          el(Text, { key: `o${i}`, style: styles.listItem }, `• ${o.objectionMd} (${o.status})`),
          o.responseMd
            ? el(Text, { key: `r${i}`, style: styles.paragraph }, `  Odpowiedź: ${o.responseMd}`)
            : null,
        ])
      )
    );
  }

  const doc = el(
    Document,
    null,
    el(
      Page,
      { size: "A4", style: styles.cover },
      el(Text, { style: styles.coverTitle }, r.projectName),
      el(Text, { style: styles.coverSubtitle }, "Pełna strategia · Syntance Strategy Hub"),
      el(Text, { style: styles.coverMeta }, `Wygenerowano: ${generated}`)
    ),
    el(
      Page,
      { size: "A4", style: styles.page },
      el(
        View,
        { style: styles.header },
        el(Text, { style: styles.title }, r.projectName)
      ),
      ...sections,
      el(Text, { style: styles.footer, fixed: true }, "Syntance · Poufne — tylko do użytku wewnętrznego")
    )
  );

  return renderToBuffer(doc);
}
