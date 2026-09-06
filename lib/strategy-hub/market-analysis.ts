import "server-only";
import { db } from "@/db";
import {
  segments,
  segmentQuickWins,
  segmentRisks,
  marketSegmentationCriteria,
} from "@/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

/**
 * Dane do widoku „Analiza rynku" — warstwa CZYTELNICZA nad istniejącymi encjami.
 *
 * Nie wprowadza własnych tabel: segmenty, kryteria segmentacji, quick winy
 * i ryzyka już istnieją i są edytowane w swoich modułach. Ten plik tylko je
 * zbiera, porządkuje i liczy to, czego nie da się odczytać gołym okiem
 * (ranking, sumy, luki w danych).
 *
 * Wszystkie encje są LOKALNE dla projektu — rynek i segmenty nie należą do
 * fundamentu (W0), więc nie ma tu osi dziedziczenia.
 */

export interface MarketDataPoint {
  label: string;
  value: string;
  source: string | null;
}

export interface SegmentScoring {
  fit: number | null;
  value: number | null;
  effort: number | null;
  total: number | null;
}

export interface SegmentationDimension {
  dimension: string;
  description: string | null;
  values: string[];
}

export interface QuickWin {
  id: string;
  title: string;
  descriptionMd: string | null;
  status: string | null;
}

export interface SegmentRisk {
  id: string;
  riskMd: string;
  mitigationMd: string | null;
  /** "low" | "medium" | "high" — tak samo jak siteAuditFindings.severity. */
  severity: string | null;
}

export interface MarketSegmentAnalysis {
  id: string;
  code: string | null;
  name: string;
  personaName: string | null;
  icon: string | null;
  status: string | null;
  priority: number | null;
  revenueSharePct: number | null;
  marketSizeMd: string | null;
  marketData: MarketDataPoint[];
  scoring: SegmentScoring;
  demographicsMd: string | null;
  jtbdMd: string | null;
  problemMd: string | null;
  budgetMd: string | null;
  segmentPricingMd: string | null;
  triggersMd: string | null;
  blockersMd: string | null;
  mentalityMd: string | null;
  emotionalDriversMd: string | null;
  quickWins: QuickWin[];
  risks: SegmentRisk[];
  /** Czego brakuje, żeby analiza tego segmentu była kompletna. */
  gaps: string[];
}

export interface MarketAnalysis {
  dimensions: SegmentationDimension[];
  criteriaNotesMd: string | null;
  segments: MarketSegmentAnalysis[];
  /** Suma zadeklarowanych udziałów w przychodzie — sygnał, gdy nie domyka się do 100%. */
  revenueSharePctTotal: number | null;
  segmentCount: number;
  /** Segmenty bez żadnych danych o wielkości rynku. */
  withoutMarketData: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function parseMarketData(raw: unknown): MarketDataPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const label = asText(entry.label);
    if (!label) return [];
    const value = asText(entry.value);
    return [{ label, value: value ?? "—", source: asText(entry.source) }];
  });
}

function parseScoring(raw: unknown): SegmentScoring {
  if (!isRecord(raw)) return { fit: null, value: null, effort: null, total: null };
  return {
    fit: asNumber(raw.fit),
    value: asNumber(raw.value),
    effort: asNumber(raw.effort),
    total: asNumber(raw.total),
  };
}

function parseDimensions(raw: unknown): SegmentationDimension[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const dimension = asText(entry.dimension);
    if (!dimension) return [];
    const values = Array.isArray(entry.values)
      ? entry.values.flatMap((v) => {
          const t = asText(v);
          return t ? [t] : [];
        })
      : [];
    return [{ dimension, description: asText(entry.description), values }];
  });
}

/** Braki liczone tak samo dla każdego segmentu — żeby widok mógł je pokazać spójnie. */
function policzLuki(s: {
  marketSizeMd: string | null;
  marketData: MarketDataPoint[];
  scoring: SegmentScoring;
  jtbdMd: string | null;
  problemMd: string | null;
  budgetMd: string | null;
}): string[] {
  const luki: string[] = [];
  if (!s.marketSizeMd && s.marketData.length === 0) luki.push("wielkość rynku");
  if (s.scoring.total === null) luki.push("scoring");
  if (!s.jtbdMd) luki.push("JTBD");
  if (!s.problemMd) luki.push("problem");
  if (!s.budgetMd) luki.push("budżet");
  return luki;
}

export async function getMarketAnalysis(projectId: string): Promise<MarketAnalysis> {
  const [segmentRows, criteriaRow] = await Promise.all([
    db
      .select()
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
      .orderBy(asc(segments.orderIdx), asc(segments.name)),
    db
      .select()
      .from(marketSegmentationCriteria)
      .where(eq(marketSegmentationCriteria.projectId, projectId))
      .limit(1),
  ]);

  const segmentIds = segmentRows.map((s) => s.id);

  const [quickWinRows, riskRows] = await Promise.all([
    segmentIds.length
      ? db
          .select()
          .from(segmentQuickWins)
          .where(
            and(
              inArray(segmentQuickWins.segmentId, segmentIds),
              isNull(segmentQuickWins.deletedAt)
            )
          )
          .orderBy(asc(segmentQuickWins.orderIdx))
      : [],
    segmentIds.length
      ? db
          .select()
          .from(segmentRisks)
          .where(
            and(
              inArray(segmentRisks.segmentId, segmentIds),
              isNull(segmentRisks.deletedAt)
            )
          )
          .orderBy(asc(segmentRisks.orderIdx))
      : [],
  ]);

  const wygrane = new Map<string, QuickWin[]>();
  for (const w of quickWinRows) {
    const lista = wygrane.get(w.segmentId) ?? [];
    lista.push({
      id: w.id,
      title: w.title,
      descriptionMd: w.descriptionMd,
      status: w.status,
    });
    wygrane.set(w.segmentId, lista);
  }

  const ryzyka = new Map<string, SegmentRisk[]>();
  for (const r of riskRows) {
    const lista = ryzyka.get(r.segmentId) ?? [];
    lista.push({
      id: r.id,
      riskMd: r.riskMd,
      mitigationMd: r.mitigationMd,
      severity: r.severity,
    });
    ryzyka.set(r.segmentId, lista);
  }

  const analizy: MarketSegmentAnalysis[] = segmentRows.map((s) => {
    const marketData = parseMarketData(s.marketData);
    const scoring = parseScoring(s.scoring);
    const podstawa = {
      marketSizeMd: s.marketSizeMd,
      marketData,
      scoring,
      jtbdMd: s.jtbdMd,
      problemMd: s.problemMd,
      budgetMd: s.budgetMd,
    };

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      personaName: s.personaName,
      icon: s.icon,
      status: s.status,
      priority: s.priority,
      revenueSharePct: s.revenueSharePct,
      marketSizeMd: s.marketSizeMd,
      marketData,
      scoring,
      demographicsMd: s.demographicsMd,
      jtbdMd: s.jtbdMd,
      problemMd: s.problemMd,
      budgetMd: s.budgetMd,
      segmentPricingMd: s.segmentPricingMd,
      triggersMd: s.triggersMd,
      blockersMd: s.blockersMd,
      mentalityMd: s.mentalityMd,
      emotionalDriversMd: s.emotionalDriversMd,
      quickWins: wygrane.get(s.id) ?? [],
      risks: ryzyka.get(s.id) ?? [],
      gaps: policzLuki(podstawa),
    };
  });

  // Ranking: najpierw scoring (malejąco), potem priorytet, na końcu nazwa.
  // Segmenty bez scoringu lądują na końcu — nie udajemy, że mają wynik 0.
  const posortowane = [...analizy].sort((a, b) => {
    const at = a.scoring.total;
    const bt = b.scoring.total;
    if (at !== null && bt !== null && at !== bt) return bt - at;
    if (at !== null && bt === null) return -1;
    if (at === null && bt !== null) return 1;
    return (b.priority ?? 0) - (a.priority ?? 0) || a.name.localeCompare(b.name, "pl");
  });

  const udzialy = analizy
    .map((s) => s.revenueSharePct)
    .filter((v): v is number => v !== null);

  return {
    dimensions: parseDimensions(criteriaRow[0]?.dimensions),
    criteriaNotesMd: criteriaRow[0]?.notesMd ?? null,
    segments: posortowane,
    revenueSharePctTotal: udzialy.length
      ? Math.round(udzialy.reduce((a, b) => a + b, 0) * 10) / 10
      : null,
    segmentCount: analizy.length,
    withoutMarketData: analizy.filter(
      (s) => !s.marketSizeMd && s.marketData.length === 0
    ).length,
  };
}
