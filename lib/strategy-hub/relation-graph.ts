import "server-only";
import { db } from "@/db";
import {
  projects,
  segments,
  purchaseStages,
  funnelElements,
  channels,
  kpis,
  pages,
  campaigns,
  geoAssets,
  offers,
  userFlows,
  competitors,
  objections,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  entityColor,
  entityHref,
  relationLabel,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import { listProjectRelationsByType } from "@/lib/strategy-hub/relations/store";

export type GraphEntityType = EntityTypeKey;

export interface GraphNode {
  id: string;
  type: GraphEntityType;
  label: string;
  meta?: string;
  href: string;
  color: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface RelationGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  savedLayout: Record<string, { x: number; y: number }> | null;
}

function nid(type: GraphEntityType, id: string): string {
  return `${type}-${id}`;
}

const SEMANTIC_RELATION_TYPES = [
  "publikowany_w",
  "mierzony_przez",
  "promowany_przez",
  "wspierany_przez",
  "prowadzi_przez",
  "skierowana_do",
] as const;

/**
 * Buduje pełny graf relacji projektu — węzły z tabel typowanych,
 * krawędzie FK + semantyczne z `entity_relations`.
 */
export async function getRelationGraphData(
  projectId: string
): Promise<RelationGraphData> {
  const [
    projectRow,
    segmentRows,
    stageRows,
    elementRows,
    channelRows,
    kpiRows,
    pageRows,
    campaignRows,
    geoRows,
    offerRows,
    flowRows,
    competitorRows,
    objectionRows,
    semanticRelations,
  ] = await Promise.all([
    db
      .select({ graphLayout: projects.graphLayout })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1),
    db
      .select()
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({
        id: purchaseStages.id,
        name: purchaseStages.name,
        phase: purchaseStages.phase,
        segmentId: purchaseStages.segmentId,
      })
      .from(purchaseStages)
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt))),
    db
      .select({
        id: funnelElements.id,
        name: funnelElements.name,
        stageId: funnelElements.stageId,
        segmentId: funnelElements.segmentId,
        format: funnelElements.format,
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select()
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select()
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt))),
    db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
    db
      .select()
      .from(geoAssets)
      .where(and(eq(geoAssets.projectId, projectId), isNull(geoAssets.deletedAt))),
    db
      .select()
      .from(offers)
      .where(and(eq(offers.projectId, projectId), isNull(offers.deletedAt))),
    db
      .select()
      .from(userFlows)
      .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
    db
      .select()
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))),
    db
      .select()
      .from(objections)
      .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt))),
    listProjectRelationsByType(projectId, [...SEMANTIC_RELATION_TYPES]),
  ]);

  const elementIds = new Set(elementRows.map((e) => e.id));
  const channelIds = new Set(channelRows.map((c) => c.id));
  const kpiIds = new Set(kpiRows.map((k) => k.id));
  const campaignIds = new Set(campaignRows.map((c) => c.id));
  const geoIds = new Set(geoRows.map((g) => g.id));
  const offerIds = new Set(offerRows.map((o) => o.id));
  const flowIds = new Set(flowRows.map((f) => f.id));
  const pageIds = new Set(pageRows.map((p) => p.id));

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let edgeSeq = 0;
  const addEdge = (source: string, target: string, label?: string) => {
    edges.push({ id: `e${edgeSeq++}`, source, target, label });
  };

  for (const s of segmentRows) {
    nodes.push({
      id: nid("segment", s.id),
      type: "segment",
      label: s.name,
      meta: s.code ?? undefined,
      href: entityHref(projectId, "segment"),
      color: entityColor("segment"),
    });
  }
  for (const st of stageRows) {
    nodes.push({
      id: nid("stage", st.id),
      type: "stage",
      label: st.name,
      meta: st.phase ?? undefined,
      href: entityHref(projectId, "stage"),
      color: entityColor("stage"),
    });
    if (st.segmentId) addEdge(nid("segment", st.segmentId), nid("stage", st.id));
  }
  for (const el of elementRows) {
    nodes.push({
      id: nid("element", el.id),
      type: "element",
      label: el.name,
      meta: el.format ?? undefined,
      href: entityHref(projectId, "element"),
      color: entityColor("element"),
    });
    addEdge(nid("stage", el.stageId), nid("element", el.id));
    if (el.segmentId) addEdge(nid("segment", el.segmentId), nid("element", el.id));
  }
  for (const c of channelRows) {
    nodes.push({
      id: nid("channel", c.id),
      type: "channel",
      label: c.name,
      meta: c.type ?? undefined,
      href: entityHref(projectId, "channel"),
      color: entityColor("channel"),
    });
  }
  for (const k of kpiRows) {
    nodes.push({
      id: nid("kpi", k.id),
      type: "kpi",
      label: k.name,
      meta: k.category ?? undefined,
      href: entityHref(projectId, "kpi"),
      color: entityColor("kpi"),
    });
    if (k.segmentId) addEdge(nid("segment", k.segmentId), nid("kpi", k.id));
  }
  for (const p of pageRows) {
    nodes.push({
      id: nid("page", p.id),
      type: "page",
      label: p.name,
      meta: p.urlPath ?? undefined,
      href: entityHref(projectId, "page"),
      color: entityColor("page"),
    });
  }
  for (const c of campaignRows) {
    nodes.push({
      id: nid("campaign", c.id),
      type: "campaign",
      label: c.name,
      meta: c.stage ?? undefined,
      href: entityHref(projectId, "campaign"),
      color: entityColor("campaign"),
    });
    if (c.segmentId) addEdge(nid("segment", c.segmentId), nid("campaign", c.id), "targetuje");
    if (c.landingPageId)
      addEdge(nid("campaign", c.id), nid("page", c.landingPageId), "ląduje na");
  }
  for (const g of geoRows) {
    nodes.push({
      id: nid("geo", g.id),
      type: "geo",
      label: g.type,
      meta: g.status ?? undefined,
      href: entityHref(projectId, "geo"),
      color: entityColor("geo"),
    });
    if (g.pageId) addEdge(nid("page", g.pageId), nid("geo", g.id), "cytowalny przez");
  }
  for (const o of offerRows) {
    nodes.push({
      id: nid("offer", o.id),
      type: "offer",
      label: o.name,
      meta: o.type ?? undefined,
      href: entityHref(projectId, "offer"),
      color: entityColor("offer"),
    });
  }
  for (const f of flowRows) {
    nodes.push({
      id: nid("flow", f.id),
      type: "flow",
      label: f.name,
      meta: f.type ?? undefined,
      href: entityHref(projectId, "flow"),
      color: entityColor("flow"),
    });
    if (f.segmentId) addEdge(nid("segment", f.segmentId), nid("flow", f.id));
    if (f.entryElementId && elementIds.has(f.entryElementId))
      addEdge(nid("element", f.entryElementId), nid("flow", f.id), "realizowany przez");
  }
  for (const c of competitorRows) {
    nodes.push({
      id: nid("competitor", c.id),
      type: "competitor",
      label: c.name,
      meta: c.type,
      href: entityHref(projectId, "competitor"),
      color: entityColor("competitor"),
    });
    if (c.segmentId) addEdge(nid("competitor", c.id), nid("segment", c.segmentId));
  }
  for (const o of objectionRows) {
    nodes.push({
      id: nid("objection", o.id),
      type: "objection",
      label: o.objectionMd.slice(0, 60),
      meta: o.stage ?? undefined,
      href: entityHref(projectId, "objection"),
      color: entityColor("objection"),
    });
    if (o.segmentId) addEdge(nid("segment", o.segmentId), nid("objection", o.id));
  }

  const elementNodeIds = new Set(elementRows.map((e) => nid("element", e.id)));

  for (const rel of semanticRelations) {
    const from = nid(rel.sourceType, rel.sourceId);
    const to = nid(rel.targetType, rel.targetId);
    const label = relationLabel(rel.relationType);

    if (rel.relationType === "publikowany_w") {
      if (elementNodeIds.has(from) && channelIds.has(rel.targetId))
        addEdge(from, to, label);
    } else if (rel.relationType === "mierzony_przez") {
      if (elementNodeIds.has(from) && kpiIds.has(rel.targetId))
        addEdge(from, to, label);
    } else if (rel.relationType === "promowany_przez") {
      if (elementNodeIds.has(from) && campaignIds.has(rel.targetId))
        addEdge(from, to, label);
    } else if (rel.relationType === "wspierany_przez") {
      if (elementNodeIds.has(from) && geoIds.has(rel.targetId))
        addEdge(from, to, label);
    } else if (rel.relationType === "skierowana_do") {
      if (offerIds.has(rel.sourceId))
        addEdge(from, to, label);
    } else if (rel.relationType === "prowadzi_przez") {
      if (flowIds.has(rel.sourceId) && pageIds.has(rel.targetId))
        addEdge(from, to, label);
    }
  }

  const rawLayout = projectRow[0]?.graphLayout;
  let savedLayout: Record<string, { x: number; y: number }> | null = null;
  if (rawLayout && typeof rawLayout === "object" && !Array.isArray(rawLayout)) {
    savedLayout = rawLayout as Record<string, { x: number; y: number }>;
  }

  return { nodes, edges, savedLayout };
}
