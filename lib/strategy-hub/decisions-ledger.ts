import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  kpis,
  pages,
  pageSections,
  userFlows,
  channels,
  campaigns,
  businessProblems,
  strategicDecisions,
  decisionLinks,
} from "@/db/schema";
import {
  isEntityTypeKey,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";

export interface LedgerDecision {
  id: string;
  title: string;
  reasonMd: string | null;
  evidenceMd: string | null;
  status: string;
  authorType: string;
  createdAt: string;
  causes: { type: EntityTypeKey; id: string; label: string }[];
  effects: { type: EntityTypeKey; id: string; label: string }[];
  segmentIds: string[];
}

async function loadLabelMaps(projectId: string): Promise<Map<string, string>> {
  const [
    segmentRows,
    stageRows,
    elementRows,
    kpiRows,
    problemRows,
    flowRows,
    pageRows,
    sectionRows,
    channelRows,
    campaignRows,
  ] = await Promise.all([
    db
      .select({ id: segments.id, name: segments.name })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({ id: purchaseStages.id, name: purchaseStages.name })
      .from(purchaseStages)
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt))),
    db
      .select({ id: funnelElements.id, name: funnelElements.name })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select({ id: kpis.id, name: kpis.name })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({ id: businessProblems.id, problemMd: businessProblems.problemMd })
      .from(businessProblems)
      .where(
        and(eq(businessProblems.projectId, projectId), isNull(businessProblems.deletedAt))
      ),
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
    db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
  ]);

  const m = new Map<string, string>();
  const put = (type: EntityTypeKey, id: string, label: string) =>
    m.set(`${type}:${id}`, label);

  for (const r of segmentRows) put("segment", r.id, r.name);
  for (const r of stageRows) put("stage", r.id, r.name);
  for (const r of elementRows) put("element", r.id, r.name);
  for (const r of kpiRows) put("kpi", r.id, r.name);
  for (const r of problemRows) {
    const short = r.problemMd.split(/[.!?]/)[0]?.trim() ?? r.problemMd;
    put("problem", r.id, short.slice(0, 80));
  }
  for (const r of flowRows) put("flow", r.id, r.name);
  for (const r of pageRows) put("page", r.id, r.name);
  for (const r of sectionRows) put("section", r.id, r.name);
  for (const r of channelRows) put("channel", r.id, r.name);
  for (const r of campaignRows) put("campaign", r.id, r.name);

  return m;
}

function segmentIdsForRef(
  ref: { type: EntityTypeKey; id: string },
  stageToSegment: Map<string, string>,
  elementToStage: Map<string, string>,
  kpiToSegment: Map<string, string>
): string[] {
  if (ref.type === "segment") return [ref.id];
  if (ref.type === "stage") {
    const seg = stageToSegment.get(ref.id);
    return seg ? [seg] : [];
  }
  if (ref.type === "element") {
    const stageId = elementToStage.get(ref.id);
    if (!stageId) return [];
    const seg = stageToSegment.get(stageId);
    return seg ? [seg] : [];
  }
  if (ref.type === "kpi") {
    const seg = kpiToSegment.get(ref.id);
    return seg ? [seg] : [];
  }
  return [];
}

export async function getDecisionsLedger(
  projectId: string
): Promise<LedgerDecision[]> {
  const [labels, decisionRows, linkRows, stageRows, elementRows, kpiRows] =
    await Promise.all([
      loadLabelMaps(projectId),
      db
        .select()
        .from(strategicDecisions)
        .where(
          and(
            eq(strategicDecisions.projectId, projectId),
            isNull(strategicDecisions.deletedAt)
          )
        )
        .orderBy(desc(strategicDecisions.createdAt)),
      db
        .select({
          decisionId: decisionLinks.decisionId,
          entityType: decisionLinks.entityType,
          entityId: decisionLinks.entityId,
          role: decisionLinks.role,
        })
        .from(decisionLinks)
        .innerJoin(
          strategicDecisions,
          eq(decisionLinks.decisionId, strategicDecisions.id)
        )
        .where(
          and(
            eq(strategicDecisions.projectId, projectId),
            isNull(strategicDecisions.deletedAt)
          )
        ),
      db
        .select({
          id: purchaseStages.id,
          segmentId: purchaseStages.segmentId,
        })
        .from(purchaseStages)
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt))),
      db
        .select({ id: funnelElements.id, stageId: funnelElements.stageId })
        .from(funnelElements)
        .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
      db
        .select({ id: kpis.id, segmentId: kpis.segmentId })
        .from(kpis)
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    ]);

  const stageToSegment = new Map(stageRows.map((s) => [s.id, s.segmentId]));
  const elementToStage = new Map(elementRows.map((e) => [e.id, e.stageId]));
  const kpiToSegment = new Map<string, string>();
  for (const k of kpiRows) {
    if (k.segmentId) kpiToSegment.set(k.id, k.segmentId);
  }

  const linksByDecision = new Map<
    string,
    { entityType: string; entityId: string; role: string }[]
  >();
  for (const link of linkRows) {
    const list = linksByDecision.get(link.decisionId) ?? [];
    list.push({
      entityType: link.entityType,
      entityId: link.entityId,
      role: link.role,
    });
    linksByDecision.set(link.decisionId, list);
  }

  return decisionRows.map((d) => {
    const links = linksByDecision.get(d.id) ?? [];
    const causes: LedgerDecision["causes"] = [];
    const effects: LedgerDecision["effects"] = [];
    const segmentIdSet = new Set<string>();

    for (const l of links) {
      if (!isEntityTypeKey(l.entityType)) continue;
      const type = l.entityType;
      const label = labels.get(`${type}:${l.entityId}`) ?? type;
      const entry = { type, id: l.entityId, label };
      if (l.role === "cause") causes.push(entry);
      else if (l.role === "effect") effects.push(entry);

      for (const segId of segmentIdsForRef(
        { type, id: l.entityId },
        stageToSegment,
        elementToStage,
        kpiToSegment
      )) {
        segmentIdSet.add(segId);
      }
    }

    for (const e of effects) {
      for (const segId of segmentIdsForRef(
        e,
        stageToSegment,
        elementToStage,
        kpiToSegment
      )) {
        segmentIdSet.add(segId);
      }
    }

    return {
      id: d.id,
      title: d.title,
      reasonMd: d.reasonMd,
      evidenceMd: d.evidenceMd,
      status: d.status ?? "active",
      authorType: d.authorType ?? "human",
      createdAt: d.createdAt.toISOString(),
      causes,
      effects,
      segmentIds: [...segmentIdSet],
    };
  });
}
