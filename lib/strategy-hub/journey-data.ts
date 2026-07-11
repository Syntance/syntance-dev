import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  salesActivities,
  campaigns,
  channelActivityPlan,
} from "@/db/schema";
import { listRelations } from "@/lib/strategy-hub/relations/store";
import { resolveRules } from "@/lib/strategy-hub/rules/resolve";
import type { JourneyCoverageConfig } from "@/lib/strategy-hub/rules/types";

/**
 * Read-model podróży zakupowej segmentu (logika Negacza):
 * etapy = kręgosłup strategii; gap engine liczy per etap, czy strategia
 * odpowiada na etap treścią, kanałem, akcją sprzedażową, wyjściem i KPI.
 */

export type CoverageKey = "content" | "channel" | "sales" | "exit" | "kpi";

export const COVERAGE_LABELS: Record<CoverageKey, string> = {
  content: "Treść",
  channel: "Kanał",
  sales: "Sprzedaż",
  exit: "Wyjście",
  kpi: "KPI",
};

export interface StageCoverageItem {
  key: CoverageKey;
  /** Czy etap ma odpowiedź tego typu. */
  ok: boolean;
  /** Czy brak liczy się jako luka (konfig reguł + wyjątki retencji/ownera/ostatniego etapu). */
  required: boolean;
}

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
  /** Suma brakujących wymaganych odpowiedzi we wszystkich etapach. */
  gapCount: number;
}

function isRetentionPhase(phase: string | null): boolean {
  return phase?.toLowerCase().includes("retencj") ?? false;
}

interface StageSignals {
  elements: number;
  sales: number;
  channel: boolean;
  exit: boolean;
  kpi: boolean;
}

function buildCoverage(
  stage: { phase: string | null; ownerSide: string },
  signals: StageSignals,
  isLast: boolean,
  cfg: JourneyCoverageConfig
): StageCoverageItem[] {
  const retention = isRetentionPhase(stage.phase);
  const salesOwned = stage.ownerSide === "sales" || stage.ownerSide === "shared";
  return [
    { key: "content", ok: signals.elements > 0, required: cfg.requireContent },
    {
      key: "channel",
      ok: signals.channel,
      required: cfg.requireChannel && !(retention && cfg.retentionSkipsChannel),
    },
    { key: "sales", ok: signals.sales > 0, required: cfg.requireSales && salesOwned },
    { key: "exit", ok: signals.exit, required: cfg.requireExit && !isLast },
    { key: "kpi", ok: signals.kpi, required: cfg.requireKpi },
  ];
}

export async function getJourneyView(
  projectId: string,
  segmentId: string | null
): Promise<JourneyView> {
  const [segmentRows, rules, relations] = await Promise.all([
    db
      .select({
        id: segments.id,
        name: segments.name,
        icon: segments.icon,
        priority: segments.priority,
      })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
      .orderBy(asc(segments.orderIdx)),
    resolveRules(projectId),
    listRelations(projectId),
  ]);

  const segmentsOut = segmentRows.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
  }));

  if (segmentRows.length === 0) {
    return { segments: segmentsOut, segmentId: null, stages: [], gapCount: 0 };
  }

  const selected =
    segmentRows.find((s) => s.id === segmentId) ??
    [...segmentRows].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];

  const stageRows = await db
    .select()
    .from(purchaseStages)
    .where(
      and(eq(purchaseStages.segmentId, selected.id), isNull(purchaseStages.deletedAt))
    )
    .orderBy(asc(purchaseStages.orderIdx));

  const stageIds = stageRows.map((s) => s.id);

  const [elementRows, activityRows, campaignRows, planRows] = await Promise.all([
    stageIds.length
      ? db
          .select({ id: funnelElements.id, stageId: funnelElements.stageId })
          .from(funnelElements)
          .where(
            and(
              inArray(funnelElements.stageId, stageIds),
              isNull(funnelElements.deletedAt)
            )
          )
      : Promise.resolve([]),
    stageIds.length
      ? db
          .select({ id: salesActivities.id, stageId: salesActivities.stageId })
          .from(salesActivities)
          .where(
            and(
              inArray(salesActivities.stageId, stageIds),
              isNull(salesActivities.deletedAt)
            )
          )
      : Promise.resolve([]),
    db
      .select({ id: campaigns.id, stageId: campaigns.stageId })
      .from(campaigns)
      .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
    db
      .select({ id: channelActivityPlan.id, stageId: channelActivityPlan.stageId })
      .from(channelActivityPlan)
      .where(isNull(channelActivityPlan.deletedAt)),
  ]);

  const elementsByStage = new Map<string, string[]>();
  for (const el of elementRows) {
    const list = elementsByStage.get(el.stageId) ?? [];
    list.push(el.id);
    elementsByStage.set(el.stageId, list);
  }
  const salesByStage = new Map<string, number>();
  for (const a of activityRows) {
    salesByStage.set(a.stageId, (salesByStage.get(a.stageId) ?? 0) + 1);
  }
  const stageIdsWithPlan = new Set<string>();
  for (const c of campaignRows) if (c.stageId) stageIdsWithPlan.add(c.stageId);
  for (const p of planRows) if (p.stageId) stageIdsWithPlan.add(p.stageId);

  // Sygnały z grafu relacji (jeden przebieg po relacjach projektu).
  const channelElementIds = new Set<string>();
  const exitElementIds = new Set<string>();
  const kpiElementIds = new Set<string>();
  for (const r of relations) {
    if (r.sourceType !== "element") continue;
    if (r.relationType === "publikowany_w" || r.relationType === "promowany_przez") {
      channelElementIds.add(r.sourceId);
    }
    if (r.relationType === "prowadzi_do_etapu" || r.relationType === "laduje_na") {
      exitElementIds.add(r.sourceId);
    }
    if (r.relationType === "mierzony_przez") {
      kpiElementIds.add(r.sourceId);
    }
  }

  const stages: JourneyStageView[] = [];
  let gapCount = 0;

  stageRows.forEach((stage, idx) => {
    const elementIds = elementsByStage.get(stage.id) ?? [];
    const signals: StageSignals = {
      elements: elementIds.length,
      sales: salesByStage.get(stage.id) ?? 0,
      channel:
        stageIdsWithPlan.has(stage.id) ||
        elementIds.some((id) => channelElementIds.has(id)),
      exit: elementIds.some((id) => exitElementIds.has(id)),
      kpi: elementIds.some((id) => kpiElementIds.has(id)),
    };
    const coverage = buildCoverage(
      { phase: stage.phase, ownerSide: stage.ownerSide },
      signals,
      idx === stageRows.length - 1,
      rules.journeyCoverage
    );
    gapCount += coverage.filter((c) => c.required && !c.ok).length;

    stages.push({
      id: stage.id,
      name: stage.name,
      phase: stage.phase,
      orderIdx: stage.orderIdx ?? 0,
      trigger: stage.trigger,
      objections: stage.objections,
      emotionalState: stage.emotionalState,
      questions: stage.questions,
      clientDoesMd: stage.clientDoesMd,
      ourActionMd: stage.ourActionMd,
      timeHint: stage.timeHint,
      exitCriterion: stage.exitCriterion,
      ownerSide: stage.ownerSide,
      coverage,
      counts: { elements: signals.elements, salesActivities: signals.sales },
    });
  });

  return { segments: segmentsOut, segmentId: selected.id, stages, gapCount };
}
