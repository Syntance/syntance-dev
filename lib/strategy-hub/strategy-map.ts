import "server-only";
import { db } from "@/db";
import {
  businessProblems,
  uvp,
  competitors,
  objections,
  segments,
  purchaseStages,
  funnelElements,
  campaigns,
  geoAssets,
  userFlows,
  channels,
  salesPitches,
  salesScripts,
  leadMagnets,
  salesActivities,
  copyGuidelines,
  pages,
  navItems,
  seoKeywords,
  kpis,
  marketSegmentationCriteria,
  pageSections,
  offers,
  funnelElementEvents,
} from "@/db/schema";
import { and, asc, eq, isNull, or, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  type StrategyMapData,
  type StrategyNode,
  type StrategyEdge,
  type StrategyNodeKey,
  type MapLeaf,
  type InfluenceGraph,
  type InfluenceNode,
  type InfluenceLink,
  type InfluenceElement,
  normalizePhase,
  isStrategyNodeKey,
} from "./strategy-map-types";
import { findModuleRule } from "./rules/defaults";
import { computeModuleScore, type CriterionContext } from "./rules/evaluate";
import { resolveRules } from "./rules/resolve";
import { resolveModuleStatuses, type ModuleStatus } from "./rules/state";
import { projectModuleHref } from "./area-routes";
import { listRelations } from "./relations/store";
import type { Correlation, RulesConfig } from "./rules/types";

function mapNodeScore(rules: RulesConfig, key: string, ctx: CriterionContext): number {
  const moduleRule = findModuleRule(rules, key);
  if (!moduleRule) return 0;
  return computeModuleScore(moduleRule, ctx);
}

function correlationMeta(
  correlations: Correlation[],
  sourceType: string,
  targetType: string
): { label: string; strength?: InfluenceLink["strength"] } {
  const match = correlations.find(
    (c) => c.sourceType === sourceType && c.targetType === targetType
  );
  return {
    label: match?.label ?? "",
    strength: match?.defaultStrength,
  };
}

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function clip(v: string | null | undefined, n = 90): string | null {
  if (!v) return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/**
 * Liczy dane funkcji Strategy Map dla projektu: 7 węzłów strategicznych
 * (status + L2 podkategorie + elementy L3), krawędzie zależności,
 * kanoniczną kolejność prezentacji oraz graf wpływu warstwy lejka.
 */
export async function getStrategyMapData(
  projectId: string,
  pathId?: string | null
): Promise<StrategyMapData> {
  const rules = await resolveRules(projectId);

  /**
   * Zakres ścieżki strategii: gdy `pathId` ustawione, pokazujemy encje
   * przypisane do tej ścieżki ORAZ ogólne (pathId IS NULL — wspólne dla
   * wszystkich ścieżek). Bez `pathId` — wszystko.
   */
  const pathScope = (col: AnyPgColumn): SQL | undefined =>
    pathId ? or(isNull(col), eq(col, pathId)) : undefined;

  const live = and(
    eq(segments.projectId, projectId),
    isNull(segments.deletedAt),
    pathScope(segments.pathId)
  );

  const [
    problemRows,
    uvpRow,
    competitorRows,
    objectionRows,
    segmentRows,
    stageRows,
    elementRows,
    flowRows,
    channelRows,
    pitchRows,
    scriptRows,
    leadMagnetRows,
    copyRow,
    pageRows,
    navRows,
    seoRows,
    kpiRows,
    elEventRows,
    campaignRows,
    geoAssetRows,
    marketCriteriaRow,
    pageSectionRows,
    offerRows,
    salesActivityRows,
  ] = await Promise.all([
    db
      .select()
      .from(businessProblems)
      .where(
        and(
          eq(businessProblems.projectId, projectId),
          isNull(businessProblems.deletedAt)
        )
      )
      .orderBy(asc(businessProblems.orderIdx)),
    db.select().from(uvp).where(eq(uvp.projectId, projectId)).limit(1),
    db
      .select()
      .from(competitors)
      .where(
        and(
          eq(competitors.projectId, projectId),
          isNull(competitors.deletedAt),
          pathScope(competitors.pathId)
        )
      ),
    db
      .select()
      .from(objections)
      .where(
        and(eq(objections.projectId, projectId), isNull(objections.deletedAt))
      )
      .orderBy(asc(objections.orderIdx)),
    db.select().from(segments).where(live).orderBy(asc(segments.orderIdx), asc(segments.name)),
    db
      .select({
        id: purchaseStages.id,
        name: purchaseStages.name,
        phase: purchaseStages.phase,
        segmentId: purchaseStages.segmentId,
        orderIdx: purchaseStages.orderIdx,
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
        cta: funnelElements.cta,
        reviewFlag: funnelElements.reviewFlag,
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select()
      .from(userFlows)
      .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
    db
      .select()
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select()
      .from(salesPitches)
      .where(
        and(eq(salesPitches.projectId, projectId), isNull(salesPitches.deletedAt))
      ),
    db
      .select()
      .from(salesScripts)
      .where(
        and(eq(salesScripts.projectId, projectId), isNull(salesScripts.deletedAt))
      ),
    db
      .select()
      .from(leadMagnets)
      .where(
        and(eq(leadMagnets.projectId, projectId), isNull(leadMagnets.deletedAt))
      ),
    db.select().from(copyGuidelines).where(eq(copyGuidelines.projectId, projectId)).limit(1),
    db
      .select()
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt)))
      .orderBy(asc(pages.priority)),
    db
      .select()
      .from(navItems)
      .where(and(eq(navItems.projectId, projectId), isNull(navItems.deletedAt))),
    db
      .select()
      .from(seoKeywords)
      .where(
        and(eq(seoKeywords.projectId, projectId), isNull(seoKeywords.deletedAt))
      ),
    db
      .select()
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db.select().from(funnelElementEvents),
    db
      .select({ id: campaigns.id, name: campaigns.name })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.projectId, projectId),
          isNull(campaigns.deletedAt),
          pathScope(campaigns.pathId)
        )
      ),
    db
      .select({ id: geoAssets.id, type: geoAssets.type })
      .from(geoAssets)
      .where(
        and(eq(geoAssets.projectId, projectId), isNull(geoAssets.deletedAt))
      ),
    db
      .select()
      .from(marketSegmentationCriteria)
      .where(eq(marketSegmentationCriteria.projectId, projectId))
      .limit(1),
    db
      .select({ id: pageSections.id })
      .from(pageSections)
      .innerJoin(pages, eq(pageSections.pageId, pages.id))
      .where(and(eq(pages.projectId, projectId), isNull(pageSections.deletedAt))),
    db
      .select({ id: offers.id })
      .from(offers)
      .where(and(eq(offers.projectId, projectId), isNull(offers.deletedAt))),
    db
      .select({
        id: salesActivities.id,
        name: salesActivities.name,
        type: salesActivities.type,
        stageId: salesActivities.stageId,
        reviewFlag: salesActivities.reviewFlag,
      })
      .from(salesActivities)
      .innerJoin(purchaseStages, eq(salesActivities.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(eq(segments.projectId, projectId), isNull(salesActivities.deletedAt))
      ),
  ]);

  const uvpData = uvpRow[0];
  const copyData = copyRow[0];
  const hasCopy = nonEmpty(copyData?.principlesMd) || nonEmpty(copyData?.doMd);

  const evalCtx: CriterionContext = {
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
    uvp: uvpData ?? null,
    copyGuidelines: copyData ?? null,
    pageSectionCount: pageSectionRows.length,
    seoKeywordCount: seoRows.length,
    geoAssetCount: geoAssetRows.length,
    offerCount: offerRows.length,
    campaignCount: campaignRows.length,
    salesActivityCount: salesActivityRows.length,
    marketCriteriaFilled: Array.isArray(marketCriteriaRow[0]?.dimensions)
      ? (marketCriteriaRow[0]!.dimensions as unknown[]).length > 0
      : false,
    kpiMeasurableRatio:
      kpiRows.length > 0
        ? kpiRows.filter((k) => !!k.eventKey).length / kpiRows.length
        : 0,
    ctaMeasurableRatio: (() => {
      const withCta = elementRows.filter((e) => nonEmpty(e.cta));
      if (withCta.length === 0) return 0;
      const conversionIds = new Set(
        elEventRows.filter((e) => e.isConversion).map((e) => e.funnelElementId)
      );
      return withCta.filter((e) => conversionIds.has(e.id)).length / withCta.length;
    })(),
  };

  /**
   * Jedno źródło stanu modułów: maszyna stanów `resolveModuleStatuses`
   * (próg gotowości z reguł, locki z `lock.requiresUpstream`, propagacja review).
   * `statusFromScore`/lokalny licznik locków po stronie klienta zostały usunięte.
   */
  const reviewByKey: Record<string, boolean> = {
    fundament: objectionRows.some((r) => r.reviewFlag),
    segmenty: segmentRows.some((r) => r.reviewFlag),
    lejek: elementRows.some((r) => r.reviewFlag),
    sprzedaz: salesActivityRows.some((r) => r.reviewFlag),
    strona: pageRows.some((r) => r.reviewFlag),
    kpi: kpiRows.some((r) => r.reviewFlag),
  };
  const statuses = resolveModuleStatuses(rules, {
    scoreOf: (key) => mapNodeScore(rules, key, evalCtx),
    reviewOf: (key) => reviewByKey[key] ?? false,
  });

  const statusOf = (key: StrategyNodeKey): ModuleStatus =>
    statuses.get(key) ?? {
      key,
      score: mapNodeScore(rules, key, evalCtx),
      state: "empty",
      locked: false,
      blockedBy: [],
      review: false,
    };

  const fundamentSt = statusOf("fundament");
  const segmentSt = statusOf("segmenty");
  const lejekSt = statusOf("lejek");
  const kanalySt = statusOf("kanaly");
  const przekazSt = statusOf("przekaz");
  const sprzedazSt = statusOf("sprzedaz");
  const stronaSt = statusOf("strona");
  const kpiSt = statusOf("kpi");

  const toLeaves = <T,>(
    rows: T[],
    map: (r: T) => MapLeaf
  ): MapLeaf[] => rows.map(map);

  const segmentLeaves = (segId: string): MapLeaf[] => {
    const s = segmentRows.find((x) => x.id === segId);
    if (!s) return [];
    const out: MapLeaf[] = [];
    if (s.personaName) out.push({ id: `${segId}-persona`, label: "Persona", note: s.personaName });
    const jtbd = clip(s.jtbdMd ?? s.jtbd);
    if (jtbd) out.push({ id: `${segId}-jtbd`, label: "JTBD", note: jtbd });
    const problem = clip(s.problemMd ?? s.problem);
    if (problem) out.push({ id: `${segId}-problem`, label: "Problem", note: problem });
    const uvpForSeg = clip(s.uvpForSegmentMd ?? s.uvpText);
    if (uvpForSeg) out.push({ id: `${segId}-uvp`, label: "UVP", note: uvpForSeg });
    return out;
  };

  const nodes: StrategyNode[] = [
    {
      key: "fundament",
      label: "Fundament",
      icon: "🎯",
      status: fundamentSt.state,
      score: fundamentSt.score,
      locked: fundamentSt.locked,
      blockedBy: fundamentSt.blockedBy,
      href: projectModuleHref(projectId, "fundament"),
      subcategories: [
        {
          id: "problemy",
          label: "Problemy / ambicje",
          count: problemRows.length,
          items: toLeaves(problemRows, (p) => ({
            id: p.id,
            label: clip(p.problemMd, 70) ?? "Problem",
            note: clip(p.ambitionMd),
          })),
        },
        {
          id: "uvp",
          label: "UVP",
          count: nonEmpty(uvpData?.coreUvpMd) ? 1 : 0,
          items: nonEmpty(uvpData?.coreUvpMd)
            ? [{ id: "uvp-core", label: "Główne UVP", note: clip(uvpData?.coreUvpMd, 140) }]
            : [],
        },
        {
          id: "konkurencja",
          label: "Konkurencja",
          count: competitorRows.length,
          items: toLeaves(competitorRows, (c) => ({
            id: c.id,
            label: c.name,
            note: c.type === "direct" ? "bezpośrednia" : c.type === "indirect" ? "pośrednia" : c.type,
          })),
        },
        {
          id: "obiekcje",
          label: "Obiekcje",
          count: objectionRows.length,
          items: toLeaves(objectionRows, (o) => ({
            id: o.id,
            label: clip(o.objectionMd, 70) ?? "Obiekcja",
            note: clip(o.responseMd),
          })),
        },
      ],
    },
    {
      key: "segmenty",
      label: "Segmenty",
      icon: "👥",
      status: segmentSt.state,
      score: segmentSt.score,
      locked: segmentSt.locked,
      blockedBy: segmentSt.blockedBy,
      href: projectModuleHref(projectId, "segmenty"),
      subcategories: segmentRows.map((s) => ({
        id: s.id,
        label: s.name,
        count: 1,
        items: segmentLeaves(s.id),
      })),
    },
    {
      key: "lejek",
      label: "Lejek",
      icon: "📣",
      status: lejekSt.state,
      score: lejekSt.score,
      locked: lejekSt.locked,
      blockedBy: lejekSt.blockedBy,
      href: projectModuleHref(projectId, "lejek"),
      subcategories: [
        {
          id: "etapy",
          label: "Etapy zakupu",
          count: stageRows.length,
          items: toLeaves(stageRows, (st) => ({
            id: st.id,
            label: st.name,
            note: st.phase,
          })),
        },
        {
          id: "elementy",
          label: "Elementy lejka",
          count: elementRows.length,
          items: toLeaves(elementRows, (e) => ({
            id: e.id,
            label: e.name,
            note: e.format,
          })),
        },
        {
          id: "flows",
          label: "User flows",
          count: flowRows.length,
          items: toLeaves(flowRows, (f) => ({
            id: f.id,
            label: f.name,
            note: clip(f.conversionGoal),
          })),
        },
      ],
    },
    {
      key: "kanaly",
      label: "Kanały",
      icon: "📡",
      status: kanalySt.state,
      score: kanalySt.score,
      locked: kanalySt.locked,
      blockedBy: kanalySt.blockedBy,
      href: projectModuleHref(projectId, "kanaly"),
      subcategories: [
        {
          id: "lista-kanalow",
          label: "Lista kanałów",
          count: channelRows.length,
          items: toLeaves(channelRows, (c) => ({
            id: c.id,
            label: `${c.icon ? `${c.icon} ` : ""}${c.name}`,
            note: c.type,
          })),
        },
      ],
    },
    {
      key: "przekaz",
      label: "Przekaz",
      icon: "✍️",
      status: przekazSt.state,
      score: przekazSt.score,
      locked: przekazSt.locked,
      blockedBy: przekazSt.blockedBy,
      href: projectModuleHref(projectId, "przekaz"),
      subcategories: [
        {
          id: "pitche",
          label: "Pitche",
          count: pitchRows.length,
          items: toLeaves(pitchRows, (p) => ({ id: p.id, label: p.title })),
        },
        {
          id: "skrypty",
          label: "Skrypty",
          count: scriptRows.length,
          items: toLeaves(scriptRows, (s) => ({ id: s.id, label: s.name })),
        },
        {
          id: "lead-magnety",
          label: "Lead magnety",
          count: leadMagnetRows.length,
          items: toLeaves(leadMagnetRows, (l) => ({ id: l.id, label: l.name })),
        },
        {
          id: "wytyczne-copy",
          label: "Wytyczne copy",
          count: hasCopy ? 1 : 0,
          items: hasCopy
            ? [{ id: "copy", label: "Wytyczne copy", note: clip(copyData?.principlesMd, 140) }]
            : [],
        },
      ],
    },
    {
      key: "sprzedaz",
      label: "Sprzedaż",
      icon: "🤝",
      status: sprzedazSt.state,
      score: sprzedazSt.score,
      locked: sprzedazSt.locked,
      blockedBy: sprzedazSt.blockedBy,
      href: projectModuleHref(projectId, "sprzedaz"),
      subcategories: [
        {
          id: "akcje-sprzedazowe",
          label: "Akcje procesu sprzedaży",
          count: salesActivityRows.length,
          items: toLeaves(salesActivityRows, (a) => ({
            id: a.id,
            label: a.name,
            note: a.type,
          })),
        },
        {
          id: "pitche-sprzedaz",
          label: "Pitche",
          count: pitchRows.length,
          items: toLeaves(pitchRows, (p) => ({ id: p.id, label: p.title })),
        },
      ],
    },
    {
      key: "strona",
      label: "Strona",
      icon: "🌐",
      status: stronaSt.state,
      score: stronaSt.score,
      locked: stronaSt.locked,
      blockedBy: stronaSt.blockedBy,
      href: projectModuleHref(projectId, "strona"),
      subcategories: [
        {
          id: "podstrony",
          label: "Mapa serwisu",
          count: pageRows.length,
          items: toLeaves(pageRows, (p) => ({
            id: p.id,
            label: p.name,
            note: p.urlPath,
          })),
        },
        {
          id: "nawigacja",
          label: "Nawigacja",
          count: navRows.length,
          items: toLeaves(navRows, (n) => ({ id: n.id, label: n.label })),
        },
        {
          id: "seo",
          label: "SEO",
          count: seoRows.length,
          items: toLeaves(seoRows, (k) => ({
            id: k.id,
            label: k.phrase,
            note: k.intent,
          })),
        },
      ],
    },
    {
      key: "kpi",
      label: "KPI",
      icon: "📊",
      status: kpiSt.state,
      score: kpiSt.score,
      locked: kpiSt.locked,
      blockedBy: kpiSt.blockedBy,
      href: projectModuleHref(projectId, "kpi"),
      subcategories: [
        {
          id: "wskazniki",
          label: "Wskaźniki",
          count: kpiRows.length,
          items: toLeaves(kpiRows, (k) => ({
            id: k.id,
            label: k.name,
            note: k.target ? `cel: ${k.target}${k.unit ? ` ${k.unit}` : ""}` : null,
          })),
        },
      ],
    },
  ];

  const edges: StrategyEdge[] = [];
  for (const c of rules.connections) {
    if (isStrategyNodeKey(c.from) && isStrategyNodeKey(c.to)) {
      edges.push({ from: c.from, to: c.to });
    }
  }

  const presentationOrder: StrategyNodeKey[] =
    rules.presentationOrder.filter(isStrategyNodeKey);

  const semanticRelations = await listRelations(projectId);
  const elChannelRows = semanticRelations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "channel" &&
        r.relationType === "publikowany_w"
    )
    .map((r) => ({ funnelElementId: r.sourceId, channelId: r.targetId }));
  const elKpiRows = semanticRelations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "kpi" &&
        r.relationType === "mierzony_przez"
    )
    .map((r) => ({ funnelElementId: r.sourceId, kpiId: r.targetId }));
  const elCampaignRows = semanticRelations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "campaign" &&
        r.relationType === "promowany_przez"
    )
    .map((r) => ({ funnelElementId: r.sourceId, campaignId: r.targetId }));
  const elGeoRows = semanticRelations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "geo" &&
        r.relationType === "wspierany_przez"
    )
    .map((r) => ({ funnelElementId: r.sourceId, geoAssetId: r.targetId }));
  const flowPageRows = semanticRelations
    .filter(
      (r) =>
        r.sourceType === "flow" &&
        r.targetType === "page" &&
        r.relationType === "prowadzi_przez"
    )
    .map((r) => ({ userFlowId: r.sourceId, pageId: r.targetId }));

  const influence = buildInfluenceGraph(
    {
      segmentRows,
      stageRows,
      elementRows,
      flowRows,
      flowPageRows,
      channelRows,
      kpiRows,
      pageRows,
      seoRows,
      objectionRows,
      elChannelRows,
      elKpiRows,
      elCampaignRows,
      elGeoRows,
      campaignRows,
      geoAssetRows,
    },
    rules.correlations
  );

  return { nodes, edges, presentationOrder, influence };
}

/** Mapowanie węzła strategii → klucz modułu widoczności. */
const NODE_MODULE: Record<StrategyNodeKey, string> = {
  fundament: "business",
  segmenty: "segments",
  lejek: "funnel",
  kanaly: "funnel",
  przekaz: "sales",
  sprzedaz: "sales",
  strona: "website",
  kpi: "kpi",
};

/**
 * Filtruje dane mapy pod tryb klienta wg widoczności modułów:
 * — moduł `hidden` → węzeł znika z mapy (wraz z krawędziami i kolejnością),
 * — moduł `in_progress` → węzeł zostaje, status „w toku", treść kart wyczyszczona.
 */
export function applyClientVisibility(
  data: StrategyMapData,
  modules: Record<string, "hidden" | "in_progress">
): StrategyMapData {
  const hiddenKeys = new Set<StrategyNodeKey>();
  const nodes = data.nodes
    .filter((n) => {
      const status = modules[NODE_MODULE[n.key]];
      if (status === "hidden") {
        hiddenKeys.add(n.key);
        return false;
      }
      return true;
    })
    .map((n) => {
      const status = modules[NODE_MODULE[n.key]];
      if (status === "in_progress") {
        return {
          ...n,
          status: "in_progress" as const,
          subcategories: n.subcategories.map((s) => ({ ...s, items: [] })),
        };
      }
      return n;
    });

  return {
    nodes,
    edges: data.edges.filter(
      (e) => !hiddenKeys.has(e.from) && !hiddenKeys.has(e.to)
    ),
    presentationOrder: data.presentationOrder.filter((k) => !hiddenKeys.has(k)),
    influence: hiddenKeys.has("lejek")
      ? { nodes: [], links: [], elements: [], segments: [] }
      : data.influence,
  };
}

// ─── Graf wpływu ─────────────────────────────────────────────────────────────

interface InfluenceInput {
  segmentRows: { id: string; name: string }[];
  stageRows: {
    id: string;
    name: string;
    phase: string | null;
    segmentId: string;
  }[];
  elementRows: {
    id: string;
    name: string;
    stageId: string;
    segmentId: string | null;
  }[];
  flowRows: { id: string; name: string; entryElementId: string | null }[];
  flowPageRows: { userFlowId: string; pageId: string }[];
  channelRows: { id: string; name: string; icon: string | null }[];
  kpiRows: { id: string; name: string }[];
  pageRows: { id: string; name: string }[];
  seoRows: { id: string; phrase: string; targetPageId: string | null }[];
  objectionRows: {
    id: string;
    objectionMd: string;
    segmentId: string | null;
    stage: string | null;
  }[];
  elChannelRows: { funnelElementId: string; channelId: string }[];
  elKpiRows: { funnelElementId: string; kpiId: string }[];
  elCampaignRows: { funnelElementId: string; campaignId: string }[];
  elGeoRows: { funnelElementId: string; geoAssetId: string }[];
  campaignRows: { id: string; name: string }[];
  geoAssetRows: { id: string; type: string }[];
}

function buildInfluenceGraph(
  input: InfluenceInput,
  correlations: Correlation[]
): InfluenceGraph {
  const {
    segmentRows,
    stageRows,
    elementRows,
    flowRows,
    flowPageRows,
    channelRows,
    kpiRows,
    pageRows,
    seoRows,
    objectionRows,
    elChannelRows,
    elKpiRows,
    elCampaignRows,
    elGeoRows,
    campaignRows,
    geoAssetRows,
  } = input;

  const nodes: InfluenceNode[] = [];
  const links: InfluenceLink[] = [];
  const seen = new Set<string>();

  const addNode = (n: InfluenceNode) => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  };

  const stageById = new Map(stageRows.map((s) => [s.id, s]));
  const channelById = new Map(channelRows.map((c) => [c.id, c]));
  const kpiById = new Map(kpiRows.map((k) => [k.id, k]));
  const campaignById = new Map(campaignRows.map((c) => [c.id, c]));
  const geoById = new Map(
    geoAssetRows.map((g) => [g.id, { id: g.id, name: g.type }])
  );
  const pageById = new Map(pageRows.map((p) => [p.id, p]));
  const segmentById = new Map(segmentRows.map((s) => [s.id, s]));

  // Relacje element → kanał / KPI
  const channelsByEl = new Map<string, string[]>();
  for (const r of elChannelRows) {
    if (!channelById.has(r.channelId)) continue;
    (channelsByEl.get(r.funnelElementId) ?? channelsByEl.set(r.funnelElementId, []).get(r.funnelElementId)!).push(r.channelId);
  }
  const kpisByEl = new Map<string, string[]>();
  for (const r of elKpiRows) {
    if (!kpiById.has(r.kpiId)) continue;
    (kpisByEl.get(r.funnelElementId) ?? kpisByEl.set(r.funnelElementId, []).get(r.funnelElementId)!).push(r.kpiId);
  }
  const campaignsByEl = new Map<string, string[]>();
  for (const r of elCampaignRows) {
    if (!campaignById.has(r.campaignId)) continue;
    (campaignsByEl.get(r.funnelElementId) ?? campaignsByEl.set(r.funnelElementId, []).get(r.funnelElementId)!).push(r.campaignId);
  }
  const geoByEl = new Map<string, string[]>();
  for (const r of elGeoRows) {
    if (!geoById.has(r.geoAssetId)) continue;
    (geoByEl.get(r.funnelElementId) ?? geoByEl.set(r.funnelElementId, []).get(r.funnelElementId)!).push(r.geoAssetId);
  }
  // Flowy wchodzące w element (entryElementId) + ich strony
  const pagesByFlow = new Map<string, string[]>();
  for (const r of flowPageRows) {
    (pagesByFlow.get(r.userFlowId) ?? pagesByFlow.set(r.userFlowId, []).get(r.userFlowId)!).push(r.pageId);
  }
  const flowsByEl = new Map<string, typeof flowRows>();
  for (const f of flowRows) {
    if (!f.entryElementId) continue;
    (flowsByEl.get(f.entryElementId) ?? flowsByEl.set(f.entryElementId, []).get(f.entryElementId)!).push(f);
  }
  const seoByPage = new Map<string, typeof seoRows>();
  for (const k of seoRows) {
    if (!k.targetPageId) continue;
    (seoByPage.get(k.targetPageId) ?? seoByPage.set(k.targetPageId, []).get(k.targetPageId)!).push(k);
  }

  const elements: InfluenceElement[] = [];
  const requiredElementTargets = correlations
    .filter((c) => c.sourceType === "element" && c.required)
    .map((c) => c.targetType);

  const isElementDisconnected = (elementId: string): boolean => {
    for (const targetType of requiredElementTargets) {
      if (targetType === "flow" && !(flowsByEl.get(elementId)?.length)) {
        return true;
      }
      if (targetType === "kpi" && !(kpisByEl.get(elementId)?.length)) {
        return true;
      }
    }
    return false;
  };

  for (const el of elementRows) {
    const stage = stageById.get(el.stageId);
    const phase = normalizePhase(stage?.phase);
    const segId = el.segmentId ?? stage?.segmentId ?? null;
    const seg = segId ? segmentById.get(segId) : null;

    addNode({ id: `el-${el.id}`, type: "element", label: el.name, phase });
    elements.push({
      id: el.id,
      label: el.name,
      segmentId: segId,
      segmentLabel: seg?.name ?? null,
      phase,
      disconnected: isElementDisconnected(el.id),
    });

    const stageLink = correlationMeta(correlations, "stage", "element");
    if (stage) {
      addNode({ id: `stage-${stage.id}`, type: "stage", label: stage.name, phase });
      links.push({
        id: `stage-${stage.id}->el-${el.id}`,
        source: `stage-${stage.id}`,
        target: `el-${el.id}`,
        label: stageLink.label || "wywołuje",
        strength: stageLink.strength ?? "strong",
      });
    }
    const goalLink = correlationMeta(correlations, "goal", "element");
    if (seg) {
      addNode({ id: `goal-${seg.id}`, type: "goal", label: seg.name, phase: null });
      links.push({
        id: `goal-${seg.id}->el-${el.id}`,
        source: `goal-${seg.id}`,
        target: `el-${el.id}`,
        label: goalLink.label || "odpowiada na",
        strength: goalLink.strength,
      });
    }
    const objectionLink = correlationMeta(correlations, "objection", "element");
    // Obiekcje pasujące do segmentu + fazy
    for (const o of objectionRows) {
      if (segId && o.segmentId && o.segmentId !== segId) continue;
      if (o.stage && phase && normalizePhase(o.stage) !== phase) continue;
      if (!o.segmentId && !o.stage) continue;
      addNode({
        id: `obj-${o.id}`,
        type: "objection",
        label: clip(o.objectionMd, 50) ?? "Obiekcja",
        phase,
      });
      links.push({
        id: `obj-${o.id}->el-${el.id}`,
        source: `obj-${o.id}`,
        target: `el-${el.id}`,
        label: objectionLink.label || "zbija",
        strength: objectionLink.strength ?? "weak",
      });
    }

    const channelLink = correlationMeta(correlations, "element", "channel");
    const campaignLink = correlationMeta(correlations, "element", "campaign");
    const geoLink = correlationMeta(correlations, "element", "geo");
    const kpiLink = correlationMeta(correlations, "element", "kpi");
    const flowLink = correlationMeta(correlations, "element", "flow");
    const flowPageLink = correlationMeta(correlations, "flow", "page");
    const pageSeoLink = correlationMeta(correlations, "page", "seo");

    // ── SKUTEK ──
    for (const chId of channelsByEl.get(el.id) ?? []) {
      const ch = channelById.get(chId)!;
      addNode({ id: `ch-${ch.id}`, type: "channel", label: ch.name, phase: null });
      links.push({
        id: `el-${el.id}->ch-${ch.id}`,
        source: `el-${el.id}`,
        target: `ch-${ch.id}`,
        label: channelLink.label || "publikowany w",
        strength: channelLink.strength,
      });
    }
    for (const campId of campaignsByEl.get(el.id) ?? []) {
      const camp = campaignById.get(campId)!;
      addNode({
        id: `camp-${camp.id}`,
        type: "campaign",
        label: camp.name,
        phase: null,
      });
      links.push({
        id: `el-${el.id}->camp-${camp.id}`,
        source: `el-${el.id}`,
        target: `camp-${camp.id}`,
        label: campaignLink.label || "promowany przez",
        strength: campaignLink.strength,
      });
    }
    for (const geoId of geoByEl.get(el.id) ?? []) {
      const geo = geoById.get(geoId)!;
      addNode({
        id: `geo-${geo.id}`,
        type: "geo",
        label: geo.name,
        phase: null,
      });
      links.push({
        id: `el-${el.id}->geo-${geo.id}`,
        source: `el-${el.id}`,
        target: `geo-${geo.id}`,
        label: geoLink.label || "cytowalny w AI przez",
        strength: geoLink.strength,
      });
    }
    for (const kpiId of kpisByEl.get(el.id) ?? []) {
      const k = kpiById.get(kpiId)!;
      addNode({ id: `kpi-${k.id}`, type: "kpi", label: k.name, phase: null });
      links.push({
        id: `el-${el.id}->kpi-${k.id}`,
        source: `el-${el.id}`,
        target: `kpi-${k.id}`,
        label: kpiLink.label || "mierzony przez",
        strength: kpiLink.strength ?? "strong",
      });
    }
    for (const flow of flowsByEl.get(el.id) ?? []) {
      addNode({ id: `flow-${flow.id}`, type: "flow", label: flow.name, phase });
      links.push({
        id: `el-${el.id}->flow-${flow.id}`,
        source: `el-${el.id}`,
        target: `flow-${flow.id}`,
        label: flowLink.label || "realizowany przez",
        strength: flowLink.strength,
      });
      for (const pageId of pagesByFlow.get(flow.id) ?? []) {
        const pg = pageById.get(pageId);
        if (!pg) continue;
        addNode({ id: `page-${pg.id}`, type: "page", label: pg.name, phase: null });
        links.push({
          id: `flow-${flow.id}->page-${pg.id}`,
          source: `flow-${flow.id}`,
          target: `page-${pg.id}`,
          label: flowPageLink.label || "ląduje na",
          strength: flowPageLink.strength,
        });
        for (const kw of seoByPage.get(pg.id) ?? []) {
          addNode({ id: `seo-${kw.id}`, type: "seo", label: kw.phrase, phase: null });
          links.push({
            id: `page-${pg.id}->seo-${kw.id}`,
            source: `page-${pg.id}`,
            target: `seo-${kw.id}`,
            label: pageSeoLink.label || "targetuje",
            strength: pageSeoLink.strength ?? "weak",
          });
        }
      }
    }
  }

  return {
    nodes,
    links,
    elements,
    segments: segmentRows.map((s) => ({ id: s.id, label: s.name })),
  };
}
