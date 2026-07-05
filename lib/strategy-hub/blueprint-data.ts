import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  kpis,
  channels,
  campaigns,
  pages,
  pageSections,
  userFlows,
} from "@/db/schema";
import {
  ENTITY_TYPE_META,
  isEntityTypeKey,
  relationLabel,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import { listRelations } from "@/lib/strategy-hub/relations/store";
import type { RelationRow } from "@/lib/strategy-hub/relations/schemas";
import {
  filterRecordsForClient,
  getProjectVisibility,
  type ProjectVisibility,
} from "@/lib/strategy-hub/visibility";

import type {
  BlueprintCellItem,
  BlueprintData,
  BlueprintRow,
  BlueprintStageColumn,
} from "@/lib/strategy-hub/blueprint-types";
export type {
  BlueprintCellItem,
  BlueprintData,
  BlueprintRow,
  BlueprintStageColumn,
} from "@/lib/strategy-hub/blueprint-types";
export { blueprintGapHref } from "@/lib/strategy-hub/blueprint-types";

function refKey(type: EntityTypeKey, id: string): string {
  return `${type}:${id}`;
}

function problemSummary(md: string | null): string | null {
  if (!md?.trim()) return null;
  const first = md.split(/[.!?]/)[0]?.trim() ?? md.trim();
  return first.length > 140 ? `${first.slice(0, 137)}…` : first;
}

function itemVisible(
  vis: ProjectVisibility | null,
  type: EntityTypeKey,
  id: string
): boolean {
  if (!vis) return true;
  if (type === "segment") {
    return filterRecordsForClient([{ id }], vis, "segments").length > 0;
  }
  if (type === "channel") {
    return filterRecordsForClient([{ id }], vis, "channels").length > 0;
  }
  return true;
}

function relationsForElements(
  relations: RelationRow[],
  elementIds: Set<string>,
  types: string[]
): RelationRow[] {
  return relations.filter(
    (r) =>
      types.includes(r.relationType) &&
      r.sourceType === "element" &&
      elementIds.has(r.sourceId)
  );
}

function dedupeItems(items: BlueprintCellItem[]): BlueprintCellItem[] {
  const seen = new Set<string>();
  const out: BlueprintCellItem[] = [];
  for (const item of items) {
    const k = refKey(item.ref.type, item.ref.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function capTresci(items: BlueprintCellItem[]): BlueprintCellItem[] {
  if (items.length <= 6) return items;
  return [
    ...items.slice(0, 5),
    {
      ...items[5],
      label: `+${items.length - 5} więcej`,
      ref: items[5].ref,
    },
  ];
}

function labelMap(
  channelsRows: { id: string; name: string }[],
  campaignRows: { id: string; name: string }[],
  flowRows: { id: string; name: string }[],
  pageRows: { id: string; name: string }[],
  sectionRows: { id: string; name: string }[],
  kpiRows: { id: string; name: string }[]
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of channelsRows) m.set(refKey("channel", r.id), r.name);
  for (const r of campaignRows) m.set(refKey("campaign", r.id), r.name);
  for (const r of flowRows) m.set(refKey("flow", r.id), r.name);
  for (const r of pageRows) m.set(refKey("page", r.id), r.name);
  for (const r of sectionRows) m.set(refKey("section", r.id), r.name);
  for (const r of kpiRows) m.set(refKey("kpi", r.id), r.name);
  return m;
}

function isRetentionPhase(phase: string | null): boolean {
  return phase?.toLowerCase().includes("retencj") ?? false;
}

export async function getBlueprint(
  projectId: string,
  segmentId: string | null,
  mode: "editor" | "client"
): Promise<BlueprintData> {
  const [segmentRows, vis, relations] = await Promise.all([
    db
      .select({
        id: segments.id,
        name: segments.name,
        icon: segments.icon,
        priority: segments.priority,
        personaName: segments.personaName,
        problemMd: segments.problemMd,
      })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
      .orderBy(asc(segments.priority)),
    mode === "client" ? getProjectVisibility(projectId) : Promise.resolve(null),
    listRelations(projectId),
  ]);

  const segmentsOut = segmentRows.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    priority: s.priority ?? 0,
  }));

  if (segmentRows.length === 0) {
    return {
      segments: segmentsOut,
      selected: null,
      columns: [],
      gapCount: 0,
    };
  }

  const selectedRow =
    segmentRows.find((s) => s.id === segmentId) ??
    [...segmentRows].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];

  const [
    stageRows,
    elementRows,
    kpiRows,
    channelRows,
    campaignRows,
    flowRows,
    pageRows,
    sectionRows,
  ] = await Promise.all([
    db
      .select({
        id: purchaseStages.id,
        name: purchaseStages.name,
        phase: purchaseStages.phase,
        orderIdx: purchaseStages.orderIdx,
        trigger: purchaseStages.trigger,
        questions: purchaseStages.questions,
      })
      .from(purchaseStages)
      .where(
        and(
          eq(purchaseStages.segmentId, selectedRow.id),
          isNull(purchaseStages.deletedAt)
        )
      )
      .orderBy(asc(purchaseStages.orderIdx)),
    db
      .select({
        id: funnelElements.id,
        name: funnelElements.name,
        stageId: funnelElements.stageId,
        position: funnelElements.position,
        reviewFlag: funnelElements.reviewFlag,
      })
      .from(funnelElements)
      .where(
        and(
          eq(funnelElements.segmentId, selectedRow.id),
          isNull(funnelElements.deletedAt)
        )
      ),
    db
      .select({
        id: kpis.id,
        name: kpis.name,
        segmentId: kpis.segmentId,
        reviewFlag: kpis.reviewFlag,
      })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
    db
      .select({ id: userFlows.id, name: userFlows.name })
      .from(userFlows)
      .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
    db
      .select({ id: pages.id, name: pages.name })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt))),
    db
      .select({ id: pageSections.id, name: pageSections.name })
      .from(pageSections)
      .innerJoin(pages, eq(pageSections.pageId, pages.id))
      .where(and(eq(pages.projectId, projectId), isNull(pageSections.deletedAt))),
  ]);

  const labels = labelMap(
    channelRows,
    campaignRows,
    flowRows,
    pageRows,
    sectionRows,
    kpiRows
  );

  const elementsByStage = new Map<string, typeof elementRows>();
  for (const el of elementRows) {
    const list = elementsByStage.get(el.stageId) ?? [];
    list.push(el);
    elementsByStage.set(el.stageId, list);
  }

  const segmentKpiIds = new Set(
    kpiRows.filter((k) => k.segmentId === selectedRow.id).map((k) => k.id)
  );

  const columns: BlueprintStageColumn[] = [];
  let gapCount = 0;

  for (const stage of stageRows) {
    const stageElements = (elementsByStage.get(stage.id) ?? []).sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, "pl")
    );
    const elementIds = new Set(stageElements.map((e) => e.id));

    let tresci: BlueprintCellItem[] = stageElements
      .filter((e) => itemVisible(vis, "element", e.id))
      .map((e) => ({
        ref: { type: "element" as const, id: e.id },
        label: e.name,
        color: ENTITY_TYPE_META.element.color,
        status: e.reviewFlag ? ("review" as const) : undefined,
      }));
    tresci = capTresci(tresci);

    const kanalyRels = relationsForElements(
      relations,
      elementIds,
      ["publikowany_w", "promowany_przez"]
    );
    let kanaly: BlueprintCellItem[] = [];
    for (const r of kanalyRels) {
      const targetType = r.targetType;
      if (!isEntityTypeKey(targetType)) continue;
      if (!itemVisible(vis, targetType, r.targetId)) continue;
      kanaly.push({
        ref: { type: targetType, id: r.targetId },
        label: labels.get(refKey(targetType, r.targetId)) ?? targetType,
        color: ENTITY_TYPE_META[targetType].color,
        viaLabel: relationLabel(r.relationType),
      });
    }
    kanaly = dedupeItems(kanaly);

    const stronaItems: BlueprintCellItem[] = [];
    const flowIds = new Set<string>();

    for (const r of relations) {
      const touchesElement =
        (r.sourceType === "element" && elementIds.has(r.sourceId)) ||
        (r.targetType === "element" && elementIds.has(r.targetId));

      if (!touchesElement) continue;

      if (r.relationType === "prowadzi_przez" && r.sourceType === "flow") {
        flowIds.add(r.sourceId);
        if (itemVisible(vis, "page", r.targetId)) {
          stronaItems.push({
            ref: { type: "page", id: r.targetId },
            label: labels.get(refKey("page", r.targetId)) ?? "Podstrona",
            color: ENTITY_TYPE_META.page.color,
            viaLabel: relationLabel(r.relationType),
          });
        }
      }
      if (r.relationType === "laduje_na") {
        const pageId = r.targetType === "page" ? r.targetId : r.sourceId;
        if (itemVisible(vis, "page", pageId)) {
          stronaItems.push({
            ref: { type: "page", id: pageId },
            label: labels.get(refKey("page", pageId)) ?? "Podstrona",
            color: ENTITY_TYPE_META.page.color,
            viaLabel: relationLabel(r.relationType),
          });
        }
      }
      if (
        (r.sourceType === "element" && r.targetType === "flow") ||
        (r.targetType === "element" && r.sourceType === "flow")
      ) {
        const fid = r.sourceType === "flow" ? r.sourceId : r.targetId;
        flowIds.add(fid);
      }
    }

    for (const fid of flowIds) {
      if (!itemVisible(vis, "flow", fid)) continue;
      stronaItems.unshift({
        ref: { type: "flow", id: fid },
        label: labels.get(refKey("flow", fid)) ?? "Flow",
        color: ENTITY_TYPE_META.flow.color,
      });
    }

    for (const r of relations) {
      if (r.relationType !== "laduje_na") continue;
      if (r.targetType === "section" && elementIds.has(r.sourceId)) {
        if (itemVisible(vis, "section", r.targetId)) {
          stronaItems.push({
            ref: { type: "section", id: r.targetId },
            label: labels.get(refKey("section", r.targetId)) ?? "Sekcja",
            color: ENTITY_TYPE_META.section.color,
            viaLabel: relationLabel(r.relationType),
          });
        }
      }
    }

    const strona = dedupeItems(stronaItems);

    let kpiItems: BlueprintCellItem[] = [];
    const kpiRels = relationsForElements(relations, elementIds, ["mierzony_przez"]);
    for (const r of kpiRels) {
      if (r.targetType !== "kpi") continue;
      if (!itemVisible(vis, "kpi", r.targetId)) continue;
      kpiItems.push({
        ref: { type: "kpi", id: r.targetId },
        label: labels.get(refKey("kpi", r.targetId)) ?? "KPI",
        color: ENTITY_TYPE_META.kpi.color,
        viaLabel: relationLabel(r.relationType),
      });
    }
    for (const r of kpiRels) {
      if (r.sourceType !== "kpi") continue;
      if (!segmentKpiIds.has(r.sourceId)) continue;
      if (!itemVisible(vis, "kpi", r.sourceId)) continue;
      kpiItems.push({
        ref: { type: "kpi", id: r.sourceId },
        label: labels.get(refKey("kpi", r.sourceId)) ?? "KPI",
        color: ENTITY_TYPE_META.kpi.color,
        viaLabel: relationLabel(r.relationType),
      });
    }
    kpiItems = dedupeItems(kpiItems);

    const cells: Record<BlueprintRow, BlueprintCellItem[]> = {
      tresci,
      kanaly,
      strona,
      kpi: kpiItems,
    };

    const gaps: BlueprintRow[] = [];
    const retention = isRetentionPhase(stage.phase);
    for (const row of ["tresci", "kanaly", "strona", "kpi"] as BlueprintRow[]) {
      if (cells[row].length > 0) continue;
      if (retention && (row === "kanaly" || row === "strona")) continue;
      gaps.push(row);
      gapCount += 1;
    }

    columns.push({
      stage: {
        id: stage.id,
        name: stage.name,
        phase: stage.phase,
        orderIdx: stage.orderIdx ?? 0,
        trigger: stage.trigger,
        questions: stage.questions,
      },
      cells,
      gaps,
    });
  }

  return {
    segments: segmentsOut,
    selected: {
      id: selectedRow.id,
      name: selectedRow.name,
      personaName: selectedRow.personaName,
      problemSummary: problemSummary(selectedRow.problemMd),
    },
    columns,
    gapCount,
  };
}
