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
  funnelElementChannels,
  funnelElementKpis,
  userFlows,
  userFlowPages,
  channels,
  salesPitches,
  salesScripts,
  leadMagnets,
  copyGuidelines,
  pages,
  navItems,
  seoKeywords,
  kpis,
} from "@/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
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
  statusFromScore,
} from "./strategy-map-types";

function pct(filled: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((filled / total) * 100);
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
  projectId: string
): Promise<StrategyMapData> {
  const base = `/strategy-hub/projects/${projectId}`;
  const live = and(eq(segments.projectId, projectId), isNull(segments.deletedAt));

  const [
    problemRows,
    uvpRow,
    competitorRows,
    objectionRows,
    segmentRows,
    stageRows,
    elementRows,
    flowRows,
    flowPageRows,
    channelRows,
    pitchRows,
    scriptRows,
    leadMagnetRows,
    copyRow,
    pageRows,
    navRows,
    seoRows,
    kpiRows,
    elChannelRows,
    elKpiRows,
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
        and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))
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
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select()
      .from(userFlows)
      .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
    db.select().from(userFlowPages),
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
    db.select().from(funnelElementChannels),
    db.select().from(funnelElementKpis),
  ]);

  const uvpData = uvpRow[0];
  const copyData = copyRow[0];

  // ── Węzeł 🎯 Fundament ──────────────────────────────────────────────────────
  const fundamentChecks = [
    problemRows.length > 0,
    nonEmpty(uvpData?.coreUvpMd),
    competitorRows.length > 0,
    objectionRows.length > 0,
  ];
  const fundamentScore = pct(
    fundamentChecks.filter(Boolean).length,
    fundamentChecks.length
  );

  // ── Węzeł 👥 Segmenty ───────────────────────────────────────────────────────
  const segmentScore =
    segmentRows.length === 0
      ? 0
      : segmentRows.length >= 3
        ? 100
        : pct(segmentRows.length, 3);

  // ── Węzeł 📣 Lejek ──────────────────────────────────────────────────────────
  const lejekChecks = [
    stageRows.length > 0,
    elementRows.length > 0,
    flowRows.length > 0,
  ];
  const lejekScore = pct(lejekChecks.filter(Boolean).length, lejekChecks.length);

  // ── Węzeł 📡 Kanały ─────────────────────────────────────────────────────────
  const kanalyScore =
    channelRows.length === 0
      ? 0
      : channelRows.length >= 4
        ? 100
        : pct(channelRows.length, 4);

  // ── Węzeł ✍️ Przekaz ────────────────────────────────────────────────────────
  const hasCopy = nonEmpty(copyData?.principlesMd) || nonEmpty(copyData?.doMd);
  const przekazChecks = [
    pitchRows.length > 0,
    scriptRows.length > 0,
    leadMagnetRows.length > 0,
    hasCopy,
  ];
  const przekazScore = pct(
    przekazChecks.filter(Boolean).length,
    przekazChecks.length
  );

  // ── Węzeł 🌐 Strona ─────────────────────────────────────────────────────────
  const stronaScore =
    pageRows.length === 0
      ? 0
      : pageRows.length >= 4
        ? 100
        : pct(pageRows.length, 4);

  // ── Węzeł 📊 KPI ────────────────────────────────────────────────────────────
  const kpiScore =
    kpiRows.length === 0 ? 0 : kpiRows.length >= 4 ? 100 : pct(kpiRows.length, 4);

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
      status: statusFromScore(fundamentScore),
      score: fundamentScore,
      href: `${base}/business`,
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
      status: statusFromScore(segmentScore),
      score: segmentScore,
      href: `${base}/segments`,
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
      status: statusFromScore(lejekScore),
      score: lejekScore,
      href: `${base}/funnel`,
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
      status: statusFromScore(kanalyScore),
      score: kanalyScore,
      href: `${base}/funnel`,
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
      status: statusFromScore(przekazScore),
      score: przekazScore,
      href: `${base}/sales`,
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
      key: "strona",
      label: "Strona",
      icon: "🌐",
      status: statusFromScore(stronaScore),
      score: stronaScore,
      href: `${base}/website`,
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
      status: statusFromScore(kpiScore),
      score: kpiScore,
      href: `${base}/kpi`,
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

  // Krawędzie zależności (spec):
  // Fundament→Segmenty→Lejek→{Kanały,Przekaz}; Segmenty→Strona; Lejek→Strona;
  // {Kanały,Strona}→KPI.
  const edges: StrategyEdge[] = [
    { from: "fundament", to: "segmenty" },
    { from: "segmenty", to: "lejek" },
    { from: "lejek", to: "kanaly" },
    { from: "lejek", to: "przekaz" },
    { from: "segmenty", to: "strona" },
    { from: "lejek", to: "strona" },
    { from: "kanaly", to: "kpi" },
    { from: "strona", to: "kpi" },
  ];

  const presentationOrder: StrategyNodeKey[] = [
    "fundament",
    "segmenty",
    "lejek",
    "kanaly",
    "przekaz",
    "strona",
    "kpi",
  ];

  const influence = buildInfluenceGraph({
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
  });

  return { nodes, edges, presentationOrder, influence };
}

/** Mapowanie węzła strategii → klucz modułu widoczności. */
const NODE_MODULE: Record<StrategyNodeKey, string> = {
  fundament: "business",
  segmenty: "segments",
  lejek: "funnel",
  kanaly: "funnel",
  przekaz: "sales",
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
}

function buildInfluenceGraph(input: InfluenceInput): InfluenceGraph {
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
      disconnected:
        !(flowsByEl.get(el.id)?.length) || !(kpisByEl.get(el.id)?.length),
    });

    // ── PRZYCZYNA ──
    if (stage) {
      addNode({ id: `stage-${stage.id}`, type: "stage", label: stage.name, phase });
      links.push({
        id: `stage-${stage.id}->el-${el.id}`,
        source: `stage-${stage.id}`,
        target: `el-${el.id}`,
        label: "wywołuje",
        strength: "strong",
      });
    }
    if (seg) {
      addNode({ id: `goal-${seg.id}`, type: "goal", label: seg.name, phase: null });
      links.push({
        id: `goal-${seg.id}->el-${el.id}`,
        source: `goal-${seg.id}`,
        target: `el-${el.id}`,
        label: "odpowiada na",
      });
    }
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
        label: "zbija",
        strength: "weak",
      });
    }

    // ── SKUTEK ──
    for (const chId of channelsByEl.get(el.id) ?? []) {
      const ch = channelById.get(chId)!;
      addNode({ id: `ch-${ch.id}`, type: "channel", label: ch.name, phase: null });
      links.push({
        id: `el-${el.id}->ch-${ch.id}`,
        source: `el-${el.id}`,
        target: `ch-${ch.id}`,
        label: "publikowany w",
      });
    }
    for (const kpiId of kpisByEl.get(el.id) ?? []) {
      const k = kpiById.get(kpiId)!;
      addNode({ id: `kpi-${k.id}`, type: "kpi", label: k.name, phase: null });
      links.push({
        id: `el-${el.id}->kpi-${k.id}`,
        source: `el-${el.id}`,
        target: `kpi-${k.id}`,
        label: "mierzony przez",
        strength: "strong",
      });
    }
    for (const flow of flowsByEl.get(el.id) ?? []) {
      addNode({ id: `flow-${flow.id}`, type: "flow", label: flow.name, phase });
      links.push({
        id: `el-${el.id}->flow-${flow.id}`,
        source: `el-${el.id}`,
        target: `flow-${flow.id}`,
        label: "realizowany przez",
      });
      for (const pageId of pagesByFlow.get(flow.id) ?? []) {
        const pg = pageById.get(pageId);
        if (!pg) continue;
        addNode({ id: `page-${pg.id}`, type: "page", label: pg.name, phase: null });
        links.push({
          id: `flow-${flow.id}->page-${pg.id}`,
          source: `flow-${flow.id}`,
          target: `page-${pg.id}`,
          label: "ląduje na",
        });
        for (const kw of seoByPage.get(pg.id) ?? []) {
          addNode({ id: `seo-${kw.id}`, type: "seo", label: kw.phrase, phase: null });
          links.push({
            id: `page-${pg.id}->seo-${kw.id}`,
            source: `page-${pg.id}`,
            target: `seo-${kw.id}`,
            label: "targetuje",
            strength: "weak",
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
