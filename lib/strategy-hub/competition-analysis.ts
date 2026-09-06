import "server-only";
import { db } from "@/db";
import { competitors, brandPositioning, segments, objections } from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { resolveFoundationSource } from "@/lib/strategy-hub/scope";

/**
 * Dane do widoku „Analiza konkurencji" — warstwa CZYTELNICZA nad istniejącymi
 * encjami. Nie wprowadza własnych tabel.
 *
 * UWAGA na dwie osie: `competitors` i `brandPositioning` należą do FUNDAMENTU
 * (W0), więc przy `strategyMode='dziedziczona'` czytamy je z projektu-źródła.
 * `segments` i `objections` są LOKALNE — dlatego mapowanie konkurent→segment
 * może się nie domknąć, gdy konkurent przyszedł z fundamentu, a wskazuje na
 * segment innego projektu. Widok pokazuje to jawnie zamiast gubić po cichu.
 */

export interface CompetitorMarker {
  label: string;
  x: number;
  y: number;
}

export interface CompetitorAnalysis {
  id: string;
  name: string;
  url: string | null;
  type: string | null;
  strengthsMd: string | null;
  weaknessesMd: string | null;
  pricingMd: string | null;
  channelsMd: string | null;
  notesMd: string | null;
  quadrantX: number | null;
  quadrantY: number | null;
  /** Nazwa segmentu, jeśli konkurent jest do niego przypisany i segment jest lokalnie widoczny. */
  segmentName: string | null;
  /** Konkurent wskazuje segment, którego nie ma w tym projekcie (skutek dziedziczenia). */
  segmentMissing: boolean;
  /** Czego brakuje, żeby analiza tego konkurenta była kompletna. */
  gaps: string[];
}

export interface CompetitionObjection {
  id: string;
  objectionMd: string;
  responseMd: string | null;
  proofMd: string | null;
  segmentName: string | null;
  priority: number | null;
}

export interface CompetitionAnalysis {
  positioning: {
    axisXLabel: string | null;
    axisYLabel: string | null;
    ourX: number | null;
    ourY: number | null;
    ourLabel: string | null;
    markers: CompetitorMarker[];
    statementMd: string | null;
    nicheMd: string | null;
    antiIcpMd: string | null;
  } | null;
  competitors: CompetitorAnalysis[];
  /** Konkurenci pogrupowani po typie — do przeglądu „z kim właściwie gramy". */
  byType: { type: string; competitors: CompetitorAnalysis[] }[];
  objections: CompetitionObjection[];
  /** Fundament dziedziczony — widok mówi, skąd pochodzi konkurencja. */
  foundationSourceName: string | null;
  competitorCount: number;
  /** Ilu konkurentów nie ma opisanych ani mocnych, ani słabych stron. */
  withoutSwot: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseMarkers(raw: unknown): CompetitorMarker[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const { label, x, y } = entry;
    if (typeof label !== "string" || typeof x !== "number" || typeof y !== "number") {
      return [];
    }
    return [{ label, x, y }];
  });
}

function policzLuki(c: {
  strengthsMd: string | null;
  weaknessesMd: string | null;
  pricingMd: string | null;
  channelsMd: string | null;
}): string[] {
  const luki: string[] = [];
  if (!c.strengthsMd) luki.push("mocne strony");
  if (!c.weaknessesMd) luki.push("słabe strony");
  if (!c.pricingMd) luki.push("cennik");
  if (!c.channelsMd) luki.push("kanały");
  return luki;
}

export async function getCompetitionAnalysis(
  projectId: string
): Promise<CompetitionAnalysis> {
  const foundation = await resolveFoundationSource(projectId);
  const fundamentId = foundation.projectId;

  const [competitorRows, positioningRow, segmentRows, objectionRows] =
    await Promise.all([
      db
        .select()
        .from(competitors)
        .where(
          and(eq(competitors.projectId, fundamentId), isNull(competitors.deletedAt))
        )
        .orderBy(asc(competitors.name)),
      db
        .select()
        .from(brandPositioning)
        .where(eq(brandPositioning.projectId, fundamentId))
        .limit(1),
      db
        .select({ id: segments.id, name: segments.name })
        .from(segments)
        .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
      db
        .select()
        .from(objections)
        .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt)))
        .orderBy(asc(objections.orderIdx)),
    ]);

  const nazwySegmentow = new Map(segmentRows.map((s) => [s.id, s.name]));

  const analizy: CompetitorAnalysis[] = competitorRows.map((c) => ({
    id: c.id,
    name: c.name,
    url: c.url,
    type: c.type,
    strengthsMd: c.strengthsMd,
    weaknessesMd: c.weaknessesMd,
    pricingMd: c.pricingMd,
    channelsMd: c.channelsMd,
    notesMd: c.notesMd,
    quadrantX: c.quadrantX,
    quadrantY: c.quadrantY,
    segmentName: c.segmentId ? nazwySegmentow.get(c.segmentId) ?? null : null,
    segmentMissing: Boolean(c.segmentId && !nazwySegmentow.has(c.segmentId)),
    gaps: policzLuki(c),
  }));

  const grupy = new Map<string, CompetitorAnalysis[]>();
  for (const c of analizy) {
    const klucz = c.type?.trim() || "Bez typu";
    const lista = grupy.get(klucz) ?? [];
    lista.push(c);
    grupy.set(klucz, lista);
  }

  const positioning = positioningRow[0]
    ? {
        axisXLabel: positioningRow[0].axisXLabel,
        axisYLabel: positioningRow[0].axisYLabel,
        ourX: positioningRow[0].ourX,
        ourY: positioningRow[0].ourY,
        ourLabel: positioningRow[0].ourLabel,
        markers: parseMarkers(positioningRow[0].competitorsOnQuadrant),
        statementMd: positioningRow[0].statementMd,
        nicheMd: positioningRow[0].nicheMd,
        antiIcpMd: positioningRow[0].antiIcpMd,
      }
    : null;

  return {
    positioning,
    competitors: analizy,
    byType: [...grupy.entries()]
      .map(([type, list]) => ({ type, competitors: list }))
      .sort((a, b) => b.competitors.length - a.competitors.length),
    objections: objectionRows.map((o) => ({
      id: o.id,
      objectionMd: o.objectionMd,
      responseMd: o.responseMd,
      proofMd: o.proofMd,
      segmentName: o.segmentId ? nazwySegmentow.get(o.segmentId) ?? null : null,
      priority: o.priority,
    })),
    foundationSourceName: foundation.inherited ? foundation.sourceName : null,
    competitorCount: analizy.length,
    withoutSwot: analizy.filter((c) => !c.strengthsMd && !c.weaknessesMd).length,
  };
}
