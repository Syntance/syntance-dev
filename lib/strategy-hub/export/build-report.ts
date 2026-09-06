import "server-only";
import { db } from "@/db";
import {
  projects,
  businessStrategy,
  uvp,
  brandPositioning,
  competitors,
  segments,
  purchaseStages,
  funnelElements,
  channels,
  kpis,
  objections,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

export interface StrategyReport {
  projectName: string;
  generatedAt: string;
  /**
   * Nazwa projektu, z którego pochodzi fundament (W0) — obecna WYŁĄCZNIE gdy
   * projekt dziedziczy strategię. Dla trybu `wlasna` klucza nie ma w ogóle,
   * żeby eksport JSON pozostał bajt w bajt taki sam jak przed dziedziczeniem.
   */
  foundationSourceName?: string;
  goalsMd: string | null;
  uvpMd: string | null;
  positioning: {
    statementMd: string | null;
    axisXLabel: string | null;
    axisYLabel: string | null;
  } | null;
  competitors: { name: string; type: string; strengthsMd: string | null; weaknessesMd: string | null }[];
  segments: {
    name: string;
    personaName: string | null;
    priority: number | null;
    jtbdMd: string | null;
    problemMd: string | null;
    uvpForSegmentMd: string | null;
  }[];
  funnel: {
    stageName: string;
    phase: string | null;
    elements: { name: string; format: string | null; status: string | null }[];
  }[];
  channels: { name: string; type: string | null; status: string | null; costMonthly: number | null }[];
  kpis: { name: string; target: string | null; actual: string | null; unit: string | null }[];
  objections: { objectionMd: string; responseMd: string | null; status: string }[];
}

/** Agreguje dane strategii projektu do jednej struktury na potrzeby eksportu (JSON/DOCX/MD). */
export async function buildStrategyReport(projectId: string): Promise<StrategyReport> {
  const [[project], foundation] = await Promise.all([
    db.select().from(projects).where(eq(projects.id, projectId)),
    resolveFoundationSource(projectId),
  ]);
  if (!project) throw new Error("Project not found");

  // Projekt w trybie `dziedziczona` czyta encje FUNDAMENTU (W0) z najbliższego
  // przodka o trybie `wlasna` — bez tego eksport strategii projektu-dziecka
  // miałby puste cele, UVP, pozycjonowanie i konkurencję, mimo kompletnej
  // strategii u rodzica. Wszystko poza W0 (segmenty, lejek, kanały, KPI,
  // obiekcje) jest ZAWSZE lokalne i zostaje na `projectId`. Nie cofaj tego.
  const fundamentId = foundation.projectId;

  const [
    [biz],
    [uvpRow],
    [positioning],
    competitorRows,
    segmentRows,
    elementRows,
    channelRows,
    kpiRows,
    objectionRows,
  ] = await Promise.all([
    // ── Fundament (W0) → `fundamentId` ───────────────────────────────────────
    db.select().from(businessStrategy).where(eq(businessStrategy.projectId, fundamentId)),
    db.select().from(uvp).where(eq(uvp.projectId, fundamentId)),
    db.select().from(brandPositioning).where(eq(brandPositioning.projectId, fundamentId)),
    db
      .select()
      .from(competitors)
      .where(and(eq(competitors.projectId, fundamentId), isNull(competitors.deletedAt))),
    // ── Reszta strategii → zawsze lokalna, na `projectId` ────────────────────
    db
      .select()
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
      .orderBy(asc(segments.priority)),
    db
      .select({
        id: funnelElements.id,
        name: funnelElements.name,
        format: funnelElements.format,
        status: funnelElements.status,
        stageId: funnelElements.stageId,
        stageName: purchaseStages.name,
        stagePhase: purchaseStages.phase,
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select()
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db.select().from(kpis).where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select()
      .from(objections)
      .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt))),
  ]);

  const funnelByStage = new Map<string, { stageName: string; phase: string | null; elements: typeof elementRows }>();
  for (const el of elementRows) {
    const key = el.stageId;
    const bucket = funnelByStage.get(key) ?? {
      stageName: el.stageName ?? "—",
      phase: el.stagePhase,
      elements: [],
    };
    bucket.elements.push(el);
    funnelByStage.set(key, bucket);
  }

  return {
    projectName: project.name,
    generatedAt: new Date().toISOString(),
    // Klucz dokładany warunkowo — przy `wlasna` raport ma dokładnie ten sam
    // zestaw pól co przed wprowadzeniem dziedziczenia (eksport JSON bez zmian).
    ...(foundation.inherited && foundation.sourceName
      ? { foundationSourceName: foundation.sourceName }
      : {}),
    goalsMd: biz?.goalsMd ?? null,
    uvpMd: uvpRow?.coreUvpMd ?? null,
    positioning: positioning
      ? {
          statementMd: positioning.statementMd,
          axisXLabel: positioning.axisXLabel,
          axisYLabel: positioning.axisYLabel,
        }
      : null,
    competitors: competitorRows.map((c) => ({
      name: c.name,
      type: c.type,
      strengthsMd: c.strengthsMd,
      weaknessesMd: c.weaknessesMd,
    })),
    segments: segmentRows.map((s) => ({
      name: s.name,
      personaName: s.personaName,
      priority: s.priority,
      jtbdMd: s.jtbdMd,
      problemMd: s.problemMd,
      uvpForSegmentMd: s.uvpForSegmentMd,
    })),
    funnel: Array.from(funnelByStage.values()).map((b) => ({
      stageName: b.stageName,
      phase: b.phase,
      elements: b.elements.map((e) => ({ name: e.name, format: e.format, status: e.status })),
    })),
    channels: channelRows.map((c) => ({
      name: c.name,
      type: c.type,
      status: c.status,
      costMonthly: c.costMonthly,
    })),
    kpis: kpiRows.map((k) => ({ name: k.name, target: k.target, actual: k.actual, unit: k.unit })),
    objections: objectionRows.map((o) => ({
      objectionMd: o.objectionMd,
      responseMd: o.responseMd,
      status: o.status,
    })),
  };
}
