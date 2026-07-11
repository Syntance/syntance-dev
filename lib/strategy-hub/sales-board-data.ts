import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  salesActivities,
  salesPitches,
  salesScripts,
  leadMagnets,
} from "@/db/schema";
import { listRelations } from "@/lib/strategy-hub/relations/store";

/**
 * Read-model Sales Process Designer: proces sprzedaży jako lustro podróży
 * zakupowej segmentu — kolumny = etapy, karty = akcje handlowe, chipy =
 * pitche/skrypty/magnety przypięte relacją „uzywany_w_etapie".
 */

export interface SalesBoardStage {
  id: string;
  name: string;
  orderIdx: number;
  ownerSide: string;
  phase: string | null;
  objections: string | null;
  exitCriterion: string | null;
}

export interface SalesBoardActivity {
  id: string;
  stageId: string;
  name: string;
  type: string | null;
  notesMd: string | null;
  status: string | null;
  orderIdx: number;
  reviewFlag: boolean;
}

export type AttachmentType = "sales_pitch" | "sales_script" | "lead_magnet";

export interface StageAttachment {
  relationId: string;
  stageId: string;
  type: AttachmentType;
  id: string;
  label: string;
}

export interface SalesBoardData {
  segments: { id: string; name: string; icon: string | null }[];
  segmentId: string | null;
  stages: SalesBoardStage[];
  activities: SalesBoardActivity[];
  attachments: StageAttachment[];
  /** Materiały projektu do przypinania (pitche/skrypty/magnety). */
  library: { type: AttachmentType; id: string; label: string }[];
}

const ATTACHMENT_TYPES: AttachmentType[] = [
  "sales_pitch",
  "sales_script",
  "lead_magnet",
];

function isAttachmentType(t: string): t is AttachmentType {
  return (ATTACHMENT_TYPES as string[]).includes(t);
}

export async function getSalesBoard(
  projectId: string,
  segmentId: string | null
): Promise<SalesBoardData> {
  const [segmentRows, relations, pitchRows, scriptRows, magnetRows] =
    await Promise.all([
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
      listRelations(projectId),
      db
        .select({ id: salesPitches.id, title: salesPitches.title })
        .from(salesPitches)
        .where(
          and(eq(salesPitches.projectId, projectId), isNull(salesPitches.deletedAt))
        ),
      db
        .select({ id: salesScripts.id, name: salesScripts.name })
        .from(salesScripts)
        .where(
          and(eq(salesScripts.projectId, projectId), isNull(salesScripts.deletedAt))
        ),
      db
        .select({ id: leadMagnets.id, name: leadMagnets.name })
        .from(leadMagnets)
        .where(
          and(eq(leadMagnets.projectId, projectId), isNull(leadMagnets.deletedAt))
        ),
    ]);

  const segmentsOut = segmentRows.map((s) => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
  }));

  const library: SalesBoardData["library"] = [
    ...pitchRows.map((p) => ({ type: "sales_pitch" as const, id: p.id, label: p.title })),
    ...scriptRows.map((s) => ({ type: "sales_script" as const, id: s.id, label: s.name })),
    ...magnetRows.map((m) => ({ type: "lead_magnet" as const, id: m.id, label: m.name })),
  ];
  const labelByRef = new Map(library.map((l) => [`${l.type}:${l.id}`, l.label]));

  if (segmentRows.length === 0) {
    return {
      segments: segmentsOut,
      segmentId: null,
      stages: [],
      activities: [],
      attachments: [],
      library,
    };
  }

  const selected =
    segmentRows.find((s) => s.id === segmentId) ??
    [...segmentRows].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];

  const stageRows = await db
    .select({
      id: purchaseStages.id,
      name: purchaseStages.name,
      orderIdx: purchaseStages.orderIdx,
      ownerSide: purchaseStages.ownerSide,
      phase: purchaseStages.phase,
      objections: purchaseStages.objections,
      exitCriterion: purchaseStages.exitCriterion,
    })
    .from(purchaseStages)
    .where(
      and(eq(purchaseStages.segmentId, selected.id), isNull(purchaseStages.deletedAt))
    )
    .orderBy(asc(purchaseStages.orderIdx));

  const stageIds = new Set(stageRows.map((s) => s.id));

  const activityRows = stageRows.length
    ? await db
        .select({
          id: salesActivities.id,
          stageId: salesActivities.stageId,
          name: salesActivities.name,
          type: salesActivities.type,
          notesMd: salesActivities.notesMd,
          status: salesActivities.status,
          orderIdx: salesActivities.orderIdx,
          reviewFlag: salesActivities.reviewFlag,
        })
        .from(salesActivities)
        .where(
          and(
            inArray(salesActivities.stageId, [...stageIds]),
            isNull(salesActivities.deletedAt)
          )
        )
        .orderBy(asc(salesActivities.orderIdx))
    : [];

  const attachments: StageAttachment[] = [];
  for (const r of relations) {
    if (r.relationType !== "uzywany_w_etapie") continue;
    if (r.targetType !== "stage" || !stageIds.has(r.targetId)) continue;
    if (!isAttachmentType(r.sourceType)) continue;
    attachments.push({
      relationId: r.id,
      stageId: r.targetId,
      type: r.sourceType,
      id: r.sourceId,
      label: labelByRef.get(`${r.sourceType}:${r.sourceId}`) ?? r.sourceType,
    });
  }

  return {
    segments: segmentsOut,
    segmentId: selected.id,
    stages: stageRows.map((s) => ({
      id: s.id,
      name: s.name,
      orderIdx: s.orderIdx ?? 0,
      ownerSide: s.ownerSide,
      phase: s.phase,
      objections: s.objections,
      exitCriterion: s.exitCriterion,
    })),
    activities: activityRows.map((a) => ({
      ...a,
      orderIdx: a.orderIdx ?? 0,
    })),
    attachments,
    library,
  };
}
