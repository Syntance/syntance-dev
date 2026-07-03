import "server-only";
import { db } from "@/db";
import {
  projects,
  segments,
  purchaseStages,
  funnelElements,
  funnelElementChannels,
  funnelElementKpis,
  funnelElementCampaigns,
  funnelElementGeo,
  channels,
  kpis,
  pages,
  campaigns,
  geoAssets,
  offers,
  offerSegments,
  userFlows,
  competitors,
  objections,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export type GraphEntityType =
  | "segment"
  | "stage"
  | "element"
  | "channel"
  | "kpi"
  | "page"
  | "campaign"
  | "geo"
  | "offer"
  | "flow"
  | "competitor"
  | "objection";

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
  /** Pozycje zapisane przez użytkownika (projects.graph_layout), keyed by node id. */
  savedLayout: Record<string, { x: number; y: number }> | null;
}

const COLOR: Record<GraphEntityType, string> = {
  segment: "#38bdf8",
  stage: "#60a5fa",
  element: "#34d399",
  channel: "#a16207",
  kpi: "#f472b6",
  page: "#475569",
  campaign: "#a78bfa",
  geo: "#22d3ee",
  offer: "#fb923c",
  flow: "#c084fc",
  competitor: "#ef4444",
  objection: "#f87171",
};

function nid(type: GraphEntityType, id: string): string {
  return `${type}-${id}`;
}

/**
 * Buduje pełny graf relacji projektu (Faza 3, M1) — WSZYSTKIE encje projektu
 * jako węzły + krawędzie relacji. Zasilany przez `<RelationGraph />` (React Flow,
 * Cmd+K „Graf relacji projektu"). Layout zapisany w `projects.graph_layout`.
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
    offerSegmentRows,
    flowRows,
    competitorRows,
    objectionRows,
    elChannelRows,
    elKpiRows,
    elCampaignRows,
    elGeoRows,
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
    db.select().from(offerSegments),
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
    db.select().from(funnelElementChannels),
    db.select().from(funnelElementKpis),
    db.select().from(funnelElementCampaigns),
    db.select().from(funnelElementGeo),
  ]);

  const elementIds = new Set(elementRows.map((e) => e.id));
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
      href: `/strategy-hub/projects/${projectId}/market/segments`,
      color: COLOR.segment,
    });
  }
  for (const st of stageRows) {
    nodes.push({
      id: nid("stage", st.id),
      type: "stage",
      label: st.name,
      meta: st.phase ?? undefined,
      href: `/strategy-hub/projects/${projectId}/execution/funnel`,
      color: COLOR.stage,
    });
    if (st.segmentId) addEdge(nid("segment", st.segmentId), nid("stage", st.id));
  }
  for (const el of elementRows) {
    nodes.push({
      id: nid("element", el.id),
      type: "element",
      label: el.name,
      meta: el.format ?? undefined,
      href: `/strategy-hub/projects/${projectId}/execution/funnel`,
      color: COLOR.element,
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
      href: `/strategy-hub/projects/${projectId}/execution/channels`,
      color: COLOR.channel,
    });
  }
  for (const k of kpiRows) {
    nodes.push({
      id: nid("kpi", k.id),
      type: "kpi",
      label: k.name,
      meta: k.category ?? undefined,
      href: `/strategy-hub/projects/${projectId}/measurement/kpi`,
      color: COLOR.kpi,
    });
    if (k.segmentId) addEdge(nid("segment", k.segmentId), nid("kpi", k.id));
  }
  for (const p of pageRows) {
    nodes.push({
      id: nid("page", p.id),
      type: "page",
      label: p.name,
      meta: p.urlPath ?? undefined,
      href: `/strategy-hub/projects/${projectId}/execution/sites`,
      color: COLOR.page,
    });
  }
  for (const c of campaignRows) {
    nodes.push({
      id: nid("campaign", c.id),
      type: "campaign",
      label: c.name,
      meta: c.stage ?? undefined,
      href: `/strategy-hub/projects/${projectId}/execution/campaigns`,
      color: COLOR.campaign,
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
      href: `/strategy-hub/projects/${projectId}/execution/geo`,
      color: COLOR.geo,
    });
    if (g.pageId) addEdge(nid("page", g.pageId), nid("geo", g.id), "cytowalny przez");
  }
  for (const o of offerRows) {
    nodes.push({
      id: nid("offer", o.id),
      type: "offer",
      label: o.name,
      meta: o.type ?? undefined,
      href: `/strategy-hub/projects/${projectId}/execution/offers`,
      color: COLOR.offer,
    });
  }
  for (const os of offerSegmentRows) {
    if (offerRows.some((o) => o.id === os.offerId))
      addEdge(nid("offer", os.offerId), nid("segment", os.segmentId), "dla segmentu");
  }
  for (const f of flowRows) {
    nodes.push({
      id: nid("flow", f.id),
      type: "flow",
      label: f.name,
      meta: f.type ?? undefined,
      href: `/strategy-hub/projects/${projectId}/execution/funnel`,
      color: COLOR.flow,
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
      href: `/strategy-hub/projects/${projectId}/foundation/business`,
      color: COLOR.competitor,
    });
    if (c.segmentId) addEdge(nid("competitor", c.id), nid("segment", c.segmentId));
  }
  for (const o of objectionRows) {
    nodes.push({
      id: nid("objection", o.id),
      type: "objection",
      label: o.objectionMd.slice(0, 60),
      meta: o.stage ?? undefined,
      href: `/strategy-hub/projects/${projectId}/foundation/business`,
      color: COLOR.objection,
    });
    if (o.segmentId) addEdge(nid("segment", o.segmentId), nid("objection", o.id));
  }

  const elementNodeIds = new Set(elementRows.map((e) => nid("element", e.id)));
  for (const ec of elChannelRows) {
    const from = nid("element", ec.funnelElementId);
    if (elementNodeIds.has(from))
      addEdge(from, nid("channel", ec.channelId), "publikowany w");
  }
  for (const ek of elKpiRows) {
    const from = nid("element", ek.funnelElementId);
    if (elementNodeIds.has(from)) addEdge(from, nid("kpi", ek.kpiId), "mierzony przez");
  }
  for (const ec of elCampaignRows) {
    const from = nid("element", ec.funnelElementId);
    if (elementNodeIds.has(from))
      addEdge(from, nid("campaign", ec.campaignId), "promowany przez");
  }
  for (const eg of elGeoRows) {
    const from = nid("element", eg.funnelElementId);
    if (elementNodeIds.has(from))
      addEdge(from, nid("geo", eg.geoAssetId), "cytowalny w AI przez");
  }

  const layout = projectRow[0]?.graphLayout as
    | Record<string, { x: number; y: number }>
    | null
    | undefined;

  return { nodes, edges, savedLayout: layout ?? null };
}
