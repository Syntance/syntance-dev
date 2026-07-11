import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  salesPitches,
  salesScripts,
  leadMagnets,
} from "@/db/schema";
import { listRelations } from "@/lib/strategy-hub/relations/store";

/**
 * Macierz przekazu (segment × etap): czy mamy CO powiedzieć każdemu segmentowi
 * na każdym etapie jego podróży zakupowej. Komórka = treści etapu + materiały
 * przypięte relacją „uzywany_w_etapie". Pusta komórka = luka przekazu.
 */

export interface MatrixCellItem {
  type: "element" | "sales_pitch" | "sales_script" | "lead_magnet";
  id: string;
  label: string;
}

export interface MatrixCell {
  stageId: string;
  stageName: string;
  orderIdx: number;
  questions: string | null;
  items: MatrixCellItem[];
  isGap: boolean;
}

export interface MatrixRow {
  segmentId: string;
  segmentName: string;
  icon: string | null;
  cells: MatrixCell[];
}

export interface MessageMatrix {
  rows: MatrixRow[];
  gapCount: number;
}

export async function getMessageMatrix(projectId: string): Promise<MessageMatrix> {
  const [segmentRows, relations, pitchRows, scriptRows, magnetRows] =
    await Promise.all([
      db
        .select({ id: segments.id, name: segments.name, icon: segments.icon })
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

  if (segmentRows.length === 0) return { rows: [], gapCount: 0 };

  const segmentIds = segmentRows.map((s) => s.id);
  const [stageRows, elementRows] = await Promise.all([
    db
      .select({
        id: purchaseStages.id,
        segmentId: purchaseStages.segmentId,
        name: purchaseStages.name,
        orderIdx: purchaseStages.orderIdx,
        questions: purchaseStages.questions,
      })
      .from(purchaseStages)
      .where(
        and(
          inArray(purchaseStages.segmentId, segmentIds),
          isNull(purchaseStages.deletedAt)
        )
      )
      .orderBy(asc(purchaseStages.orderIdx)),
    db
      .select({
        id: funnelElements.id,
        name: funnelElements.name,
        stageId: funnelElements.stageId,
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .where(
        and(
          inArray(purchaseStages.segmentId, segmentIds),
          isNull(funnelElements.deletedAt)
        )
      ),
  ]);

  const labelByRef = new Map<string, string>();
  for (const p of pitchRows) labelByRef.set(`sales_pitch:${p.id}`, p.title);
  for (const s of scriptRows) labelByRef.set(`sales_script:${s.id}`, s.name);
  for (const m of magnetRows) labelByRef.set(`lead_magnet:${m.id}`, m.name);

  const elementsByStage = new Map<string, MatrixCellItem[]>();
  for (const el of elementRows) {
    const list = elementsByStage.get(el.stageId) ?? [];
    list.push({ type: "element", id: el.id, label: el.name });
    elementsByStage.set(el.stageId, list);
  }

  const attachmentsByStage = new Map<string, MatrixCellItem[]>();
  for (const r of relations) {
    if (r.relationType !== "uzywany_w_etapie" || r.targetType !== "stage") continue;
    if (
      r.sourceType !== "sales_pitch" &&
      r.sourceType !== "sales_script" &&
      r.sourceType !== "lead_magnet"
    ) {
      continue;
    }
    const list = attachmentsByStage.get(r.targetId) ?? [];
    list.push({
      type: r.sourceType,
      id: r.sourceId,
      label: labelByRef.get(`${r.sourceType}:${r.sourceId}`) ?? r.sourceType,
    });
    attachmentsByStage.set(r.targetId, list);
  }

  let gapCount = 0;
  const rows: MatrixRow[] = segmentRows.map((seg) => {
    const cells: MatrixCell[] = stageRows
      .filter((st) => st.segmentId === seg.id)
      .map((st) => {
        const items = [
          ...(elementsByStage.get(st.id) ?? []),
          ...(attachmentsByStage.get(st.id) ?? []),
        ];
        const isGap = items.length === 0;
        if (isGap) gapCount += 1;
        return {
          stageId: st.id,
          stageName: st.name,
          orderIdx: st.orderIdx ?? 0,
          questions: st.questions,
          items,
          isGap,
        };
      });
    return {
      segmentId: seg.id,
      segmentName: seg.name,
      icon: seg.icon,
      cells,
    };
  });

  return { rows, gapCount };
}
