import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  salesActivities,
  campaigns,
  channels,
  channelActivityPlan,
} from "@/db/schema";
import { listRelations } from "@/lib/strategy-hub/relations/store";
import { resolveRules } from "@/lib/strategy-hub/rules/resolve";
import type { JourneyCoverageConfig } from "@/lib/strategy-hub/rules/types";
import type { CoverageKey, StageCoverageItem } from "@/lib/strategy-hub/coverage";

/**
 * JEDNO źródło prawdy o pokryciu podróży zakupowej (gap engine, logika Negacza).
 * Z tego liczą: Journey Designer, health score, Strategy Canvas i Pipeline —
 * żeby aplikacja nie mówiła czterema sprzecznymi głosami o kompletności.
 * Klucze i etykiety (UI): `lib/strategy-hub/coverage.ts`.
 */

export type { CoverageKey, StageCoverageItem };

interface StageCoverage {
  id: string;
  segmentId: string;
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
  gapCount: number;
}

interface SegmentCoverage {
  segmentId: string;
  segmentName: string;
  segmentIcon: string | null;
  priority: number | null;
  stages: StageCoverage[];
  gapCount: number;
}

interface SlotTotals {
  required: number;
  covered: number;
}

export interface ProjectCoverage {
  segments: SegmentCoverage[];
  /** Segmenty bez ani jednego etapu podróży. */
  segmentsWithoutJourney: { segmentId: string; segmentName: string }[];
  stageCount: number;
  gapCount: number;
  /** Sumy wymaganych/pokrytych odpowiedzi per typ slotu. */
  slots: Record<CoverageKey, SlotTotals>;
  requiredTotal: number;
  coveredTotal: number;
}

/**
 * Udział pokrytych wymaganych odpowiedzi (0–1) dla wybranych slotów.
 * Semantyka pustki: brak etapów = 0 (nie ma podróży → nie ma maszyny);
 * etapy są, ale nic nie jest wymagane (wyjątki reguł) = 1.
 */
export function coverageRatio(
  cov: ProjectCoverage,
  keys?: CoverageKey[]
): number {
  if (cov.stageCount === 0) return 0;
  const selected = keys ?? (Object.keys(cov.slots) as CoverageKey[]);
  let required = 0;
  let covered = 0;
  for (const k of selected) {
    required += cov.slots[k].required;
    covered += cov.slots[k].covered;
  }
  if (required === 0) return 1;
  return covered / required;
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

export async function computeProjectCoverage(
  projectId: string
): Promise<ProjectCoverage> {
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

  const emptySlots = (): Record<CoverageKey, SlotTotals> => ({
    content: { required: 0, covered: 0 },
    channel: { required: 0, covered: 0 },
    sales: { required: 0, covered: 0 },
    exit: { required: 0, covered: 0 },
    kpi: { required: 0, covered: 0 },
  });

  if (segmentRows.length === 0) {
    return {
      segments: [],
      segmentsWithoutJourney: [],
      stageCount: 0,
      gapCount: 0,
      slots: emptySlots(),
      requiredTotal: 0,
      coveredTotal: 0,
    };
  }

  const segmentIds = segmentRows.map((s) => s.id);

  const stageRows = await db
    .select()
    .from(purchaseStages)
    .where(
      and(
        inArray(purchaseStages.segmentId, segmentIds),
        isNull(purchaseStages.deletedAt)
      )
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
    // Plan aktywności scoped do projektu przez kanał (audyt 2026-07-17: wcześniej
    // ładował wiersze wszystkich projektów).
    db
      .select({ id: channelActivityPlan.id, stageId: channelActivityPlan.stageId })
      .from(channelActivityPlan)
      .innerJoin(channels, eq(channelActivityPlan.channelId, channels.id))
      .where(
        and(eq(channels.projectId, projectId), isNull(channelActivityPlan.deletedAt))
      ),
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
  /** KPI przypięte wprost do etapu: relacja stage → kpi `mierzony_przez`. */
  const kpiStageIds = new Set<string>();
  for (const r of relations) {
    if (r.sourceType === "stage") {
      if (r.relationType === "mierzony_przez" && r.targetType === "kpi") {
        kpiStageIds.add(r.sourceId);
      }
      continue;
    }
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

  const stagesBySegment = new Map<string, typeof stageRows>();
  for (const stage of stageRows) {
    const list = stagesBySegment.get(stage.segmentId) ?? [];
    list.push(stage);
    stagesBySegment.set(stage.segmentId, list);
  }

  const slots = emptySlots();
  const segmentsOut: SegmentCoverage[] = [];
  const segmentsWithoutJourney: ProjectCoverage["segmentsWithoutJourney"] = [];
  let gapCount = 0;

  for (const seg of segmentRows) {
    const segStages = stagesBySegment.get(seg.id) ?? [];
    if (segStages.length === 0) {
      segmentsWithoutJourney.push({ segmentId: seg.id, segmentName: seg.name });
    }

    const stagesOut: StageCoverage[] = [];
    let segGapCount = 0;

    segStages.forEach((stage, idx) => {
      const elementIds = elementsByStage.get(stage.id) ?? [];
      const signals: StageSignals = {
        elements: elementIds.length,
        sales: salesByStage.get(stage.id) ?? 0,
        channel:
          stageIdsWithPlan.has(stage.id) ||
          elementIds.some((id) => channelElementIds.has(id)),
        exit: elementIds.some((id) => exitElementIds.has(id)),
        kpi:
          kpiStageIds.has(stage.id) ||
          elementIds.some((id) => kpiElementIds.has(id)),
      };
      const coverage = buildCoverage(
        { phase: stage.phase, ownerSide: stage.ownerSide },
        signals,
        idx === segStages.length - 1,
        rules.journeyCoverage
      );

      let stageGaps = 0;
      for (const item of coverage) {
        if (!item.required) continue;
        slots[item.key].required += 1;
        if (item.ok) slots[item.key].covered += 1;
        else stageGaps += 1;
      }
      segGapCount += stageGaps;

      stagesOut.push({
        id: stage.id,
        segmentId: stage.segmentId,
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
        gapCount: stageGaps,
      });
    });

    gapCount += segGapCount;
    segmentsOut.push({
      segmentId: seg.id,
      segmentName: seg.name,
      segmentIcon: seg.icon,
      priority: seg.priority,
      stages: stagesOut,
      gapCount: segGapCount,
    });
  }

  const requiredTotal = (Object.keys(slots) as CoverageKey[]).reduce(
    (acc, k) => acc + slots[k].required,
    0
  );
  const coveredTotal = (Object.keys(slots) as CoverageKey[]).reduce(
    (acc, k) => acc + slots[k].covered,
    0
  );

  return {
    segments: segmentsOut,
    segmentsWithoutJourney,
    stageCount: stageRows.length,
    gapCount,
    slots,
    requiredTotal,
    coveredTotal,
  };
}
