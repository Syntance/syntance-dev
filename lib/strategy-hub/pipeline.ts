import "server-only";
import { db } from "@/db";
import {
  aiProposals,
  changeHistory,
  objections,
  pages,
  projectQuestions,
  segments,
  funnelElements,
  kpis,
} from "@/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  ENTITY_TYPE_META,
  isEntityTypeKey,
  type StrategyArea,
} from "@/lib/strategy-hub/entities/entity-types";
import { projectModuleHref } from "@/lib/strategy-hub/area-routes";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import type {
  PipelineData,
  PipelineStage,
  PipelineStageKey,
  PipelineStageStatus,
} from "./pipeline-types";

const STAGE_ORDER: PipelineStageKey[] = [
  "brief",
  "research",
  "fundament",
  "segmenty",
  "lejek",
  "kanaly",
  "przekaz",
  "strona",
  "kpi",
];

const STAGE_LABELS: Record<PipelineStageKey, string> = {
  brief: "Brief / Discovery",
  research: "Research AI",
  fundament: "Fundament",
  segmenty: "Segmenty",
  lejek: "Lejek",
  kanaly: "Kanały",
  przekaz: "Przekaz",
  strona: "Strona",
  kpi: "KPI",
};

const MODULE_FOR_STAGE: Partial<Record<PipelineStageKey, string>> = {
  brief: "discovery",
  fundament: "fundament",
  segmenty: "segmenty",
  lejek: "lejek",
  kanaly: "kanaly",
  przekaz: "przekaz",
  strona: "strona",
  kpi: "kpi",
};

const REVIEW_AREA: Partial<
  Record<
    StrategyArea,
    { label: (row: Record<string, unknown>) => string; hrefModule: string }
  >
> = {
  fundament: {
    label: (r) =>
      `Przegląd obiekcji: ${String(r.objectionMd ?? "").slice(0, 50)}…`,
    hrefModule: "fundament",
  },
  segmenty: {
    label: (r) => `Przegląd segmentu: ${String(r.name ?? "")}`,
    hrefModule: "segmenty",
  },
  lejek: {
    label: (r) => `Przegląd elementu lejka: ${String(r.name ?? "")}`,
    hrefModule: "lejek",
  },
  strona: {
    label: (r) => `Przegląd podstrony: ${String(r.name ?? "")}`,
    hrefModule: "strona",
  },
  kpi: {
    label: (r) => `Przegląd KPI: ${String(r.name ?? "")}`,
    hrefModule: "kpi",
  },
};

function stageForEntityType(entityType: string): PipelineStageKey | null {
  if (entityType === "projectQuestion" || entityType === "projectMaterial") {
    return "brief";
  }
  if (entityType === "relation") return null;
  if (isEntityTypeKey(entityType)) {
    return ENTITY_TYPE_META[entityType].area;
  }
  return null;
}

function summarizeChange(
  entityType: string,
  field: string | null,
  newValue: string | null
): string {
  const typeLabel = isEntityTypeKey(entityType)
    ? ENTITY_TYPE_META[entityType].label
    : entityType;
  if (field === "__created") return `Utworzono ${typeLabel.toLowerCase()}`;
  if (field === "__deleted") return `Usunięto ${typeLabel.toLowerCase()}`;
  if (field && newValue) {
    const clip =
      newValue.length > 80 ? `${newValue.slice(0, 80)}…` : newValue;
    return `Zmiana ${field} (${typeLabel}): ${clip}`;
  }
  return `Aktualizacja ${typeLabel.toLowerCase()}`;
}

function researchScore(count: number): number {
  if (count <= 0) return 0;
  if (count >= 5) return 100;
  return Math.min(100, count * 25);
}

function researchModuleStatus(count: number): Exclude<PipelineStageStatus, "locked"> {
  if (count <= 0) return "empty";
  if (count >= 5) return "ready";
  return "in_progress";
}

export async function getPipelineData(projectId: string): Promise<PipelineData> {
  const [health, aiChanges, appliedProposals, openQuestions, reviewData] =
    await Promise.all([
      computeProjectHealth(projectId),
      db
        .select({
          entityType: changeHistory.entityType,
          field: changeHistory.field,
          newValue: changeHistory.newValue,
          batchId: changeHistory.batchId,
          createdAt: changeHistory.createdAt,
        })
        .from(changeHistory)
        .where(
          and(
            eq(changeHistory.projectId, projectId),
            eq(changeHistory.source, "ai"),
            isNull(changeHistory.undoneAt)
          )
        )
        .orderBy(desc(changeHistory.createdAt))
        .limit(200),
      db
        .select({
          mode: aiProposals.mode,
          entityType: aiProposals.entityType,
          rationaleMd: aiProposals.rationaleMd,
          batchId: aiProposals.batchId,
          createdAt: aiProposals.createdAt,
        })
        .from(aiProposals)
        .where(
          and(
            eq(aiProposals.projectId, projectId),
            eq(aiProposals.status, "applied")
          )
        )
        .orderBy(desc(aiProposals.createdAt))
        .limit(100),
      db
        .select({ id: projectQuestions.id, question: projectQuestions.question })
        .from(projectQuestions)
        .where(
          and(
            eq(projectQuestions.projectId, projectId),
            eq(projectQuestions.status, "open"),
            isNull(projectQuestions.deletedAt)
          )
        )
        .limit(20),
      Promise.all([
        db
          .select({
            id: objections.id,
            objectionMd: objections.objectionMd,
          })
          .from(objections)
          .where(
            and(
              eq(objections.projectId, projectId),
              eq(objections.reviewFlag, true),
              isNull(objections.deletedAt)
            )
          )
          .limit(5),
        db
          .select({ id: segments.id, name: segments.name })
          .from(segments)
          .where(
            and(
              eq(segments.projectId, projectId),
              eq(segments.reviewFlag, true),
              isNull(segments.deletedAt)
            )
          )
          .limit(5),
        db
          .select({ id: funnelElements.id, name: funnelElements.name })
          .from(funnelElements)
          .innerJoin(segments, eq(funnelElements.segmentId, segments.id))
          .where(
            and(
              eq(segments.projectId, projectId),
              eq(funnelElements.reviewFlag, true),
              isNull(funnelElements.deletedAt)
            )
          )
          .limit(5),
        db
          .select({ id: pages.id, name: pages.name })
          .from(pages)
          .where(
            and(
              eq(pages.projectId, projectId),
              eq(pages.reviewFlag, true),
              isNull(pages.deletedAt)
            )
          )
          .limit(5),
        db
          .select({ id: kpis.id, name: kpis.name })
          .from(kpis)
          .where(
            and(
              eq(kpis.projectId, projectId),
              eq(kpis.reviewFlag, true),
              isNull(kpis.deletedAt)
            )
          )
          .limit(5),
      ]),
    ]);

  const moduleByKey = new Map(health.modules.map((m) => [m.key, m]));

  const aiActionsByStage = new Map<
    PipelineStageKey,
    PipelineStage["aiActions"]
  >();
  for (const key of STAGE_ORDER) {
    aiActionsByStage.set(key, []);
  }

  for (const row of aiChanges) {
    const stage = stageForEntityType(row.entityType);
    if (!stage) continue;
    const list = aiActionsByStage.get(stage)!;
    if (list.length >= 5) continue;
    list.push({
      at: row.createdAt.toISOString(),
      summary: summarizeChange(row.entityType, row.field, row.newValue),
      batchId: row.batchId,
    });
  }

  for (const row of appliedProposals) {
    const stage: PipelineStageKey =
      row.mode === "research"
        ? "research"
        : row.entityType
          ? (stageForEntityType(row.entityType) ?? "fundament")
          : "fundament";
    const list = aiActionsByStage.get(stage)!;
    if (list.length >= 5) continue;
    const summary =
      row.rationaleMd?.trim().slice(0, 120) ??
      `Propozycja AI (${row.mode})`;
    list.push({
      at: row.createdAt.toISOString(),
      summary,
      batchId: row.batchId,
    });
  }

  const researchCount = appliedProposals.filter((p) => p.mode === "research").length;

  const reviewByArea: Partial<Record<StrategyArea, Record<string, unknown>[]>> = {
    fundament: reviewData[0],
    segmenty: reviewData[1],
    lejek: reviewData[2],
    strona: reviewData[3],
    kpi: reviewData[4],
  };

  const stages: PipelineStage[] = [];
  let blockDownstream = false;

  for (let i = 0; i < STAGE_ORDER.length; i++) {
    const key = STAGE_ORDER[i]!;
    const humanGates: PipelineStage["humanGates"] = [];
    let rawStatus: Exclude<PipelineStageStatus, "locked"> = "empty";
    let score = 0;

    if (key === "brief") {
      const mod = moduleByKey.get("discovery");
      score = mod?.score ?? 0;
      rawStatus = mod?.state ?? "empty";
      for (const q of openQuestions) {
        humanGates.push({
          label: `Odpowiedz: ${q.question.slice(0, 60)}${q.question.length > 60 ? "…" : ""}`,
          href: projectModuleHref(projectId, "discovery"),
        });
      }
    } else if (key === "research") {
      score = researchScore(researchCount);
      rawStatus = researchModuleStatus(researchCount);
    } else {
      const moduleKey = MODULE_FOR_STAGE[key];
      const mod = moduleKey ? moduleByKey.get(moduleKey) : undefined;
      score = mod?.score ?? 0;
      rawStatus = mod?.state ?? "empty";

      const area = key as StrategyArea;
      const reviewCfg = REVIEW_AREA[area];
      const reviewItems = reviewByArea[area] ?? [];
      if (reviewCfg) {
        for (const item of reviewItems) {
          humanGates.push({
            label: reviewCfg.label(item),
            href: projectModuleHref(projectId, reviewCfg.hrefModule),
          });
        }
      }
    }

    const status: PipelineStageStatus = blockDownstream ? "locked" : rawStatus;

    if (blockDownstream) {
      const prevKey = STAGE_ORDER[i - 1];
      if (prevKey) {
        humanGates.unshift({
          label: `Najpierw ukończ etap: ${STAGE_LABELS[prevKey]}`,
          href: projectModuleHref(
            projectId,
            MODULE_FOR_STAGE[prevKey] ?? "discovery"
          ),
        });
      }
    }

    blockDownstream = blockDownstream || rawStatus === "empty";

    stages.push({
      key,
      label: STAGE_LABELS[key],
      status,
      score,
      aiActions: aiActionsByStage.get(key) ?? [],
      humanGates,
    });
  }

  return { stages };
}

export type { PipelineData, PipelineStage } from "./pipeline-types";
