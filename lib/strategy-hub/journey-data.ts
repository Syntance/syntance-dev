import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { kpis } from "@/db/schema";
import {
  computeProjectCoverage,
  type CoverageKey,
  type StageCoverageItem,
} from "@/lib/strategy-hub/journey-coverage";

/**
 * Read-model podróży zakupowej segmentu (logika Negacza).
 * Liczby liczy `computeProjectCoverage` — TEN SAM gap engine co health score,
 * Canvas i Pipeline (jedno źródło prawdy, audyt 2026-07-17).
 */

export type { CoverageKey };

export interface JourneyStageView {
  id: string;
  name: string;
  phase: string | null;
  orderIdx: number;
  trigger: string | null;
  objections: string | null;
  emotionalState: string | null;
  questions: string | null;
  clientDoesMd: string | null;
  ourActionMd: string | null;
  timeHint: string | null;
  exitCriterion: string | null;
  ownerSide: string;
  coverage: StageCoverageItem[];
  counts: { elements: number; salesActivities: number };
}

export interface JourneyView {
  segments: { id: string; name: string; icon: string | null }[];
  segmentId: string | null;
  stages: JourneyStageView[];
  /** Suma brakujących wymaganych odpowiedzi we wszystkich etapach segmentu. */
  gapCount: number;
  /** KPI projektu — do przypinania do etapu (relacja stage → kpi `mierzony_przez`). */
  kpis: { id: string; name: string }[];
}

export async function getJourneyView(
  projectId: string,
  segmentId: string | null
): Promise<JourneyView> {
  const [coverage, kpiRows] = await Promise.all([
    computeProjectCoverage(projectId),
    db
      .select({ id: kpis.id, name: kpis.name })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)))
      .orderBy(asc(kpis.name)),
  ]);

  const segmentsOut = coverage.segments.map((s) => ({
    id: s.segmentId,
    name: s.segmentName,
    icon: s.segmentIcon,
  }));

  const kpisOut = kpiRows.map((k) => ({ id: k.id, name: k.name }));

  if (coverage.segments.length === 0) {
    return {
      segments: segmentsOut,
      segmentId: null,
      stages: [],
      gapCount: 0,
      kpis: kpisOut,
    };
  }

  const selected =
    coverage.segments.find((s) => s.segmentId === segmentId) ??
    [...coverage.segments].sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    )[0]!;

  return {
    segments: segmentsOut,
    segmentId: selected.segmentId,
    stages: selected.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      phase: stage.phase,
      orderIdx: stage.orderIdx,
      trigger: stage.trigger,
      objections: stage.objections,
      emotionalState: stage.emotionalState,
      questions: stage.questions,
      clientDoesMd: stage.clientDoesMd,
      ourActionMd: stage.ourActionMd,
      timeHint: stage.timeHint,
      exitCriterion: stage.exitCriterion,
      ownerSide: stage.ownerSide,
      coverage: stage.coverage,
      counts: stage.counts,
    })),
    gapCount: selected.gapCount,
    kpis: kpisOut,
  };
}
