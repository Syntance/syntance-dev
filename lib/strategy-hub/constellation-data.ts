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
  businessProblems,
  seoKeywords,
  strategicDecisions,
  salesPitches,
  salesScripts,
  leadMagnets,
  pageSections,
  sites,
  geoQueries,
  salesActivities,
} from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import {
  ENTITY_TYPE_META,
  entityColor,
  entityHref,
  relationLabel,
  type EntityTypeKey,
  type StrategyArea,
} from "@/lib/strategy-hub/entities/entity-types";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import { listRelations } from "@/lib/strategy-hub/relations/store";
import { findModuleRule } from "@/lib/strategy-hub/rules/defaults";
import { computeModuleScore, type CriterionContext } from "@/lib/strategy-hub/rules/evaluate";
import { resolveRules } from "@/lib/strategy-hub/rules/resolve";
import { resolveModuleStatuses } from "@/lib/strategy-hub/rules/state";
import {
  isStrategyNodeKey,
  type NodeStatus,
  type StrategyNodeKey,
} from "@/lib/strategy-hub/strategy-map-types";
import {
  getProjectVisibility,
  type ProjectVisibility,
} from "@/lib/strategy-hub/visibility";
import {
  AREA_META,
  CORE_NODE_ID,
  areaNodeId,
  entityNodeId,
  type ConstellationData,
  type ConstellationLink,
  type ConstellationNode,
} from "@/lib/strategy-hub/constellation-types";

const MAX_ENTITIES_PER_AREA = 40;

const AREA_VISIBILITY_MODULE: Record<StrategyArea, string> = {
  fundament: "business",
  segmenty: "segments",
  lejek: "funnel",
  kanaly: "funnel",
  przekaz: "sales",
  sprzedaz: "sales",
  strona: "website",
  kpi: "kpi",
};

const RECORD_VISIBILITY_TYPE: Partial<Record<EntityTypeKey, string>> = {
  segment: "segments",
  channel: "channels",
};

interface RawEntity {
  type: EntityTypeKey;
  id: string;
  label: string;
  priority: number;
}

function hubHref(projectId: string, segment: string, entityId?: string): string {
  const base = `/strategy-hub/projects/${projectId}/${segment}`;
  return entityId ? `${base}?focus=${entityId}` : base;
}

function scoreOfModule(
  rules: Awaited<ReturnType<typeof resolveRules>>,
  ctx: CriterionContext,
  key: string
): number {
  const moduleRule = findModuleRule(rules, key);
  if (!moduleRule) return 0;
  return computeModuleScore(moduleRule, ctx);
}

function areaStatus(
  statuses: ReturnType<typeof resolveModuleStatuses>,
  area: StrategyArea,
  mode: "editor" | "client"
): NodeStatus {
  const st = statuses.get(area)?.state ?? "empty";
  if (mode === "client" && (st === "empty" || st === "review")) {
    return "in_progress";
  }
  return st;
}

function isRecordVisible(
  vis: ProjectVisibility,
  type: EntityTypeKey,
  id: string
): boolean {
  const visType = RECORD_VISIBILITY_TYPE[type];
  if (!visType) return true;
  const status = vis.records[visType]?.[id];
  return status !== "hidden";
}

function isAreaVisible(vis: ProjectVisibility, area: StrategyArea): boolean {
  const moduleKey = AREA_VISIBILITY_MODULE[area];
  return vis.modules[moduleKey] !== "hidden";
}

function sortEntities(items: RawEntity[]): RawEntity[] {
  return [...items].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.label.localeCompare(b.label, "pl");
  });
}

/**
 * Buduje read-model widoku Konstelacji: rdzeń → 7 obszarów → encje + cross-linki.
 */
export async function getConstellationData(
  projectId: string,
  mode: "editor" | "client" = "editor"
): Promise<ConstellationData> {
  const [
    projectRow,
    rules,
    health,
    vis,
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
    problemRows,
    seoRows,
    decisionRows,
    pitchRows,
    scriptRows,
    leadMagnetRows,
    sectionRows,
    siteRows,
    geoQueryRows,
    salesActivityRows,
    semanticRelations,
  ] = await Promise.all([
    db
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1),
    resolveRules(projectId),
    computeProjectHealth(projectId),
    mode === "client" ? getProjectVisibility(projectId) : Promise.resolve(null),
    db
      .select({ id: segments.id, name: segments.name })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({
        id: purchaseStages.id,
        name: purchaseStages.name,
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
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select({ id: kpis.id, name: kpis.name })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({
        id: pages.id,
        name: pages.name,
        priority: pages.priority,
      })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt))),
    db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
    db
      .select({ id: geoAssets.id, type: geoAssets.type })
      .from(geoAssets)
      .where(and(eq(geoAssets.projectId, projectId), isNull(geoAssets.deletedAt))),
    db
      .select({ id: offers.id, name: offers.name })
      .from(offers)
      .where(and(eq(offers.projectId, projectId), isNull(offers.deletedAt))),
    db
      .select({
        id: userFlows.id,
        name: userFlows.name,
        segmentId: userFlows.segmentId,
        entryElementId: userFlows.entryElementId,
      })
      .from(userFlows)
      .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
    db
      .select({ id: competitors.id, name: competitors.name })
      .from(competitors)
      .where(and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))),
    db
      .select({
        id: objections.id,
        objectionMd: objections.objectionMd,
      })
      .from(objections)
      .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt))),
    db
      .select({
        id: businessProblems.id,
        problemMd: businessProblems.problemMd,
        priority: businessProblems.priority,
      })
      .from(businessProblems)
      .where(
        and(eq(businessProblems.projectId, projectId), isNull(businessProblems.deletedAt))
      ),
    db
      .select({
        id: seoKeywords.id,
        phrase: seoKeywords.phrase,
      })
      .from(seoKeywords)
      .where(and(eq(seoKeywords.projectId, projectId), isNull(seoKeywords.deletedAt))),
    db
      .select({
        id: strategicDecisions.id,
        title: strategicDecisions.title,
      })
      .from(strategicDecisions)
      .where(
        and(eq(strategicDecisions.projectId, projectId), isNull(strategicDecisions.deletedAt))
      ),
    db
      .select({ id: salesPitches.id, title: salesPitches.title })
      .from(salesPitches)
      .where(and(eq(salesPitches.projectId, projectId), isNull(salesPitches.deletedAt))),
    db
      .select({ id: salesScripts.id, name: salesScripts.name })
      .from(salesScripts)
      .where(and(eq(salesScripts.projectId, projectId), isNull(salesScripts.deletedAt))),
    db
      .select({ id: leadMagnets.id, name: leadMagnets.name })
      .from(leadMagnets)
      .where(and(eq(leadMagnets.projectId, projectId), isNull(leadMagnets.deletedAt))),
    db
      .select({
        id: pageSections.id,
        name: pageSections.name,
        orderIdx: pageSections.orderIdx,
        pageId: pageSections.pageId,
      })
      .from(pageSections)
      .innerJoin(pages, eq(pageSections.pageId, pages.id))
      .where(and(eq(pages.projectId, projectId), isNull(pageSections.deletedAt))),
    db
      .select({ id: sites.id, name: sites.name, isPrimary: sites.isPrimary })
      .from(sites)
      .where(and(eq(sites.projectId, projectId), isNull(sites.deletedAt))),
    db
      .select({
        id: geoQueries.id,
        query: geoQueries.query,
      })
      .from(geoQueries)
      .where(and(eq(geoQueries.projectId, projectId), isNull(geoQueries.deletedAt))),
    db
      .select({
        id: salesActivities.id,
        name: salesActivities.name,
        stageId: salesActivities.stageId,
      })
      .from(salesActivities)
      .innerJoin(purchaseStages, eq(salesActivities.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(eq(segments.projectId, projectId), isNull(salesActivities.deletedAt))
      ),
    listRelations(projectId),
  ]);

  const projectName = projectRow[0]?.name ?? "Projekt";

  const ctx: CriterionContext = {
    segN: segmentRows.length,
    chN: channelRows.length,
    pitchN: pitchRows.length,
    scriptN: scriptRows.length,
    pageN: pageRows.length,
    kpiN: kpiRows.length,
    qN: 0,
    matN: 0,
    problemCount: problemRows.length,
    competitorCount: competitorRows.length,
    objectionCount: objectionRows.length,
    stageCount: stageRows.length,
    elementCount: elementRows.length,
    flowCount: flowRows.length,
    leadMagnetCount: leadMagnetRows.length,
    salesActivityCount: salesActivityRows.length,
    brandIdentity: null,
    brandVisual: null,
    uvp: null,
    copyGuidelines: null,
    kpiMeasurableRatio: 0,
    ctaMeasurableRatio: 0,
  };

  const statuses = resolveModuleStatuses(rules, {
    scoreOf: (key) => scoreOfModule(rules, ctx, key),
  });

  const areasOrder = rules.presentationOrder.filter(isStrategyNodeKey) as StrategyArea[];

  const nodes: ConstellationNode[] = [];
  const links: ConstellationLink[] = [];
  let linkSeq = 0;

  nodes.push({
    id: CORE_NODE_ID,
    kind: "core",
    label: projectName,
    color: "#a78bfa",
    parentId: null,
    score: health.score,
  });

  const visibleAreas = areasOrder.filter(
    (area) => !vis || isAreaVisible(vis, area)
  );

  for (const area of visibleAreas) {
    const meta = AREA_META[area];
    const areaKey = area as StrategyNodeKey;
    const modScore = statuses.get(areaKey)?.score ?? scoreOfModule(rules, ctx, areaKey);
    const nodeId = areaNodeId(area);

    nodes.push({
      id: nodeId,
      kind: "area",
      label: meta.label,
      color: meta.color,
      status: areaStatus(statuses, area, mode),
      score: modScore,
      href: hubHref(projectId, meta.hrefSegment),
      parentId: CORE_NODE_ID,
    });

    links.push({
      id: `tree-${linkSeq++}`,
      sourceId: CORE_NODE_ID,
      targetId: nodeId,
      kind: "tree",
    });
  }

  const rawByArea = new Map<StrategyArea, RawEntity[]>();

  const pushRaw = (type: EntityTypeKey, id: string, label: string, priority = 0) => {
    if (vis && !isRecordVisible(vis, type, id)) return;
    const area = ENTITY_TYPE_META[type].area;
    if (!visibleAreas.includes(area)) return;
    const list = rawByArea.get(area) ?? [];
    list.push({ type, id, label, priority });
    rawByArea.set(area, list);
  };

  for (const s of segmentRows) pushRaw("segment", s.id, s.name);
  for (const st of stageRows) pushRaw("stage", st.id, st.name);
  for (const el of elementRows) pushRaw("element", el.id, el.name);
  for (const c of channelRows) pushRaw("channel", c.id, c.name);
  for (const k of kpiRows) pushRaw("kpi", k.id, k.name);
  for (const p of pageRows) pushRaw("page", p.id, p.name, p.priority ?? 0);
  for (const c of campaignRows) pushRaw("campaign", c.id, c.name);
  for (const g of geoRows) pushRaw("geo", g.id, g.type);
  for (const o of offerRows) pushRaw("offer", o.id, o.name);
  for (const f of flowRows) pushRaw("flow", f.id, f.name);
  for (const c of competitorRows) pushRaw("competitor", c.id, c.name);
  for (const o of objectionRows) {
    pushRaw("objection", o.id, o.objectionMd.slice(0, 60));
  }
  for (const p of problemRows) {
    pushRaw("problem", p.id, p.problemMd.slice(0, 60), p.priority ?? 0);
  }
  for (const s of seoRows) pushRaw("seo_keyword", s.id, s.phrase);
  for (const d of decisionRows) pushRaw("decision", d.id, d.title);
  for (const p of pitchRows) pushRaw("sales_pitch", p.id, p.title);
  for (const s of scriptRows) pushRaw("sales_script", s.id, s.name);
  for (const lm of leadMagnetRows) pushRaw("lead_magnet", lm.id, lm.name);
  for (const sec of sectionRows) {
    pushRaw("section", sec.id, sec.name, sec.orderIdx ?? 0);
  }
  for (const st of siteRows) {
    pushRaw("site", st.id, st.name, st.isPrimary ? 10 : 0);
  }
  for (const gq of geoQueryRows) {
    pushRaw("geo_query", gq.id, gq.query.slice(0, 60));
  }
  for (const sa of salesActivityRows) pushRaw("sales_activity", sa.id, sa.name);

  const entityNodeIds = new Set<string>();

  for (const area of visibleAreas) {
    const all = sortEntities(rawByArea.get(area) ?? []);
    const slice = all.slice(0, MAX_ENTITIES_PER_AREA);
    const overflow = all.length - slice.length;
    const parentId = areaNodeId(area);

    for (const ent of slice) {
      const id = entityNodeId(ent.type, ent.id);
      entityNodeIds.add(id);
      nodes.push({
        id,
        kind: "entity",
        entityType: ent.type,
        label: ent.label,
        color: entityColor(ent.type),
        href: entityHref(projectId, ent.type),
        parentId,
      });
      links.push({
        id: `tree-${linkSeq++}`,
        sourceId: parentId,
        targetId: id,
        kind: "tree",
      });
    }

    if (overflow > 0) {
      const areaNode = nodes.find((n) => n.id === parentId);
      if (areaNode) areaNode.childCount = overflow;
    }
  }

  const addFkCross = (
    sourceType: EntityTypeKey,
    sourceId: string,
    targetType: EntityTypeKey,
    targetId: string,
    label?: string
  ) => {
    const sid = entityNodeId(sourceType, sourceId);
    const tid = entityNodeId(targetType, targetId);
    if (!entityNodeIds.has(sid) || !entityNodeIds.has(tid)) return;
    links.push({
      id: `fk-${linkSeq++}`,
      sourceId: sid,
      targetId: tid,
      kind: "cross",
      relationLabel: label,
    });
  };

  for (const st of stageRows) {
    if (st.segmentId) addFkCross("segment", st.segmentId, "stage", st.id);
  }
  for (const el of elementRows) {
    addFkCross("stage", el.stageId, "element", el.id);
    if (el.segmentId) addFkCross("segment", el.segmentId, "element", el.id);
  }
  for (const f of flowRows) {
    if (f.segmentId) addFkCross("segment", f.segmentId, "flow", f.id);
    if (f.entryElementId) {
      addFkCross("element", f.entryElementId, "flow", f.id, "realizowany przez");
    }
  }
  for (const sec of sectionRows) {
    addFkCross("page", sec.pageId, "section", sec.id);
  }

  for (const rel of semanticRelations) {
    const sourceId = entityNodeId(rel.sourceType, rel.sourceId);
    const targetId = entityNodeId(rel.targetType, rel.targetId);
    if (!entityNodeIds.has(sourceId) || !entityNodeIds.has(targetId)) continue;
    links.push({
      id: `cross-${linkSeq++}`,
      sourceId,
      targetId,
      kind: "cross",
      relationLabel: relationLabel(rel.relationType),
      aiGenerated: rel.source === "ai",
    });
  }

  return {
    nodes,
    links,
    areasOrder: visibleAreas,
    health: health.score,
  };
}

export type {
  ConstellationData,
  ConstellationLink,
  ConstellationNode,
} from "@/lib/strategy-hub/constellation-types";
