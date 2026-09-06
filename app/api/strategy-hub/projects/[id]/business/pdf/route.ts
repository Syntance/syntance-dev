import { NextResponse } from "next/server";
import { strategyListItemsToMarkdown } from "@/lib/strategy-hub/business-strategy-lists";
import { db } from "@/db";
import { businessStrategy, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import React from "react";
import { getAdminSession, getClientSession } from "@/lib/auth";

export const runtime = "nodejs";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    color: "#1a1a1a",
  },
  header: {
    borderBottom: "2 solid #6d28d9",
    paddingBottom: 12,
    marginBottom: 24,
  },
  title: { fontSize: 22, fontWeight: 700, color: "#0a0a0a" },
  subtitle: { fontSize: 10, color: "#666", marginTop: 4 },
  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#6d28d9",
    marginBottom: 8,
    borderBottom: "1 solid #e5e5e5",
    paddingBottom: 4,
  },
  paragraph: { marginBottom: 6 },
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

function StrategyDoc({
  projectName,
  generatedAt,
  sections,
  foundationSourceName,
}: {
  projectName: string;
  generatedAt: string;
  sections: { title: string; md: string }[];
  /**
   * Nazwa projektu-źródła fundamentu — tylko przy trybie `dziedziczona`.
   * Bez tego czytelnik PDF-a nie wie, że strategia nie powstała w tym projekcie.
   */
  foundationSourceName?: string;
}) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(Text, { style: styles.title }, projectName),
        React.createElement(
          Text,
          { style: styles.subtitle },
          `Strategia biznesowa · ${generatedAt} · Syntance Strategy Hub` +
            (foundationSourceName
              ? ` · fundament z projektu „${foundationSourceName}"`
              : "")
        )
      ),
      ...sections.map((s, idx) =>
        React.createElement(
          View,
          { key: idx, style: styles.section, wrap: true },
          React.createElement(Text, { style: styles.sectionTitle }, s.title),
          ...s.md
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((para, pIdx) =>
              React.createElement(
                Text,
                { key: pIdx, style: styles.paragraph },
                para.replace(/^#+\s+/, "")
              )
            )
        )
      ),
      React.createElement(
        Text,
        { style: styles.footer, fixed: true },
        "Syntance · Poufne — tylko do użytku wewnętrznego"
      )
    )
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = (await getAdminSession()) ?? (await getClientSession());
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [projRows, foundation] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, id)).limit(1),
    resolveFoundationSource(id),
  ]);
  const project = projRows[0];
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Projekt w trybie `dziedziczona` czyta encje FUNDAMENTU (W0) z najbliższego
  // przodka o trybie `wlasna` — bez tego PDF strategii projektu-dziecka byłby
  // pusty, mimo kompletnej strategii u rodzica. Nagłówek i nazwa pliku zostają
  // na `id`, bo dokument opisuje TEN projekt. Nie cofaj tego.
  const fundamentId = foundation.projectId;

  const stratRows = await db
    .select()
    .from(businessStrategy)
    .where(eq(businessStrategy.projectId, fundamentId))
    .limit(1);
  const strategy = stratRows[0];

  const sections = [
    {
      title: "Cele biznesowe",
      md: strategyListItemsToMarkdown(strategy?.goalsMd),
    },
    { title: "UVP", md: strategyListItemsToMarkdown(strategy?.uvpMd) },
    { title: "Konkurencja", md: strategy?.competitorsMd ?? "—" },
    {
      title: "Obiekcje klientów",
      md: strategyListItemsToMarkdown(strategy?.objectionsMd),
    },
  ];

  const buffer = await renderToBuffer(
    StrategyDoc({
      projectName: project.name,
      generatedAt: new Date().toLocaleDateString("pl-PL"),
      sections,
      // Przy `wlasna` prop zostaje `undefined` → nagłówek PDF-a jest identyczny
      // jak przed wprowadzeniem dziedziczenia.
      foundationSourceName:
        foundation.inherited && foundation.sourceName
          ? foundation.sourceName
          : undefined,
    })
  );

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="strategia-${project.slug}.pdf"`,
    },
  });
}
