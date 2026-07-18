import "server-only";
import { and, eq, isNull } from "drizzle-orm";
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
  ENTITY_TYPE_META,
  isEntityTypeKey,
  relationLabel,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";
import { listRelations, type RelationRow } from "@/lib/strategy-hub/relations/store";
import type { EntityRef } from "@/lib/strategy-hub/relations/schemas";
import {
  getProjectVisibility,
  type ProjectVisibility,
} from "@/lib/strategy-hub/visibility";
import type {
  ThreadData,
  ThreadDecision,
  ThreadEdge,
  ThreadNode,
} from "@/lib/strategy-hub/thread-types";
export type { ThreadData } from "@/lib/strategy-hub/thread-types";

const CANONICAL_AXIS: EntityTypeKey[] = [
  "segment",
  "problem",
  "stage",
  "element",
  "flow",
  "page",
  "section",
  "kpi",
];

const MAX_AXIS_NODES = 8;
const MAX_DECISIONS_PER_EDGE = 2;

const RECORD_VISIBILITY_TYPE: Partial<Record<EntityTypeKey, string>> = {
  segment: "segments",
  channel: "channels",
};

function refKey(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

function axisIndex(type: EntityTypeKey): number {
  return CANONICAL_AXIS.indexOf(type);
}

function isOnAxis(type: EntityTypeKey): boolean {
  return axisIndex(type) >= 0;
}

function isEntityVisible(
  vis: ProjectVisibility,
  type: EntityTypeKey,
  id: string
): boolean {
  const visType = RECORD_VISIBILITY_TYPE[type];
  if (!visType) return true;
  return vis.records[visType]?.[id] !== "hidden";
}

interface ThreadContext {
  relations: RelationRow[];
  labels: Map<string, string>;
  elementToStage: Map<string, string>;
  stageToSegment: Map<string, string>;
  kpiToSegment: Map<string, string>;
  segmentToStages: Map<string, string[]>;
  stageToElements: Map<string, string[]>;
}

interface NeighborCandidate {
  ref: EntityRef;
  strength: number;
  updatedAt: number;
  relationType?: string;
  fkLabel?: string;
}

function relationBetween(
  relations: RelationRow[],
  a: EntityRef,
  b: EntityRef
): RelationRow | undefined {
  return relations.find(
    (r) =>
      (r.sourceType === a.type &&
        r.sourceId === a.id &&
        r.targetType === b.type &&
        r.targetId === b.id) ||
      (r.sourceType === b.type &&
        r.sourceId === b.id &&
        r.targetType === a.type &&
        r.targetId === a.id)
  );
}

function edgeLabelBetween(
  ctx: ThreadContext,
  from: EntityRef,
  to: EntityRef
): { label: string; rationaleMd?: string } {
  const rel = relationBetween(ctx.relations, from, to);
  if (rel) {
    return { label: relationLabel(rel.relationType), rationaleMd: rel.rationaleMd ?? undefined };
  }

  const fi = axisIndex(from.type);
  const ti = axisIndex(to.type);
  if (fi < 0 || ti < 0) return { label: "powiązany z" };

  if (from.type === "stage" && to.type === "segment") {
    return { label: "segmentu" };
  }
  if (from.type === "element" && to.type === "stage") {
    return { label: "w etapie" };
  }
  if (from.type === "kpi" && to.type === "segment") {
    return { label: "segmentu" };
  }
  if (from.type === "segment" && to.type === "stage") {
    return { label: "segmentu" };
  }
  if (from.type === "stage" && to.type === "element") {
    return { label: "w etapie" };
  }
  if (from.type === "segment" && to.type === "kpi") {
    return { label: "segmentu" };
  }

  return { label: "…" };
}

function getNeighborCandidates(ref: EntityRef, ctx: ThreadContext): NeighborCandidate[] {
  const out: NeighborCandidate[] = [];

  for (const r of ctx.relations) {
    if (r.sourceType === ref.type && r.sourceId === ref.id) {
      out.push({
        ref: { type: r.targetType, id: r.targetId },
        strength: r.strength ?? 0.5,
        updatedAt: r.updatedAt.getTime(),
        relationType: r.relationType,
      });
    } else if (r.targetType === ref.type && r.targetId === ref.id) {
      out.push({
        ref: { type: r.sourceType, id: r.sourceId },
        strength: r.strength ?? 0.5,
        updatedAt: r.updatedAt.getTime(),
        relationType: r.relationType,
      });
    }
  }

  if (ref.type === "element") {
    const stageId = ctx.elementToStage.get(ref.id);
    if (stageId) {
      out.push({
        ref: { type: "stage", id: stageId },
        strength: 1,
        updatedAt: 0,
        fkLabel: "w etapie",
      });
    }
  }
  if (ref.type === "stage") {
    const segId = ctx.stageToSegment.get(ref.id);
    if (segId) {
      out.push({
        ref: { type: "segment", id: segId },
        strength: 1,
        updatedAt: 0,
        fkLabel: "segmentu",
      });
    }
    for (const elId of ctx.stageToElements.get(ref.id) ?? []) {
      out.push({
        ref: { type: "element", id: elId },
        strength: 0.95,
        updatedAt: 0,
        fkLabel: "w etapie",
      });
    }
  }
  if (ref.type === "kpi") {
    const segId = ctx.kpiToSegment.get(ref.id);
    if (segId) {
      out.push({
        ref: { type: "segment", id: segId },
        strength: 1,
        updatedAt: 0,
        fkLabel: "segmentu",
      });
    }
  }
  if (ref.type === "segment") {
    for (const stageId of ctx.segmentToStages.get(ref.id) ?? []) {
      out.push({
        ref: { type: "stage", id: stageId },
        strength: 0.95,
        updatedAt: 0,
        fkLabel: "segmentu",
      });
    }
  }

  return out;
}

function pickBestNeighbor(
  candidates: NeighborCandidate[],
  direction: "up" | "down",
  currentIdx: number,
  visited: Set<string>
): NeighborCandidate | null {
  const eligible = candidates.filter((c) => {
    if (visited.has(refKey(c.ref))) return false;
    const idx = axisIndex(c.ref.type);
    if (idx < 0) return false;
    if (currentIdx < 0) return true;
    return direction === "up" ? idx < currentIdx : idx > currentIdx;
  });

  const pool =
    eligible.length > 0
      ? eligible
      : currentIdx < 0
        ? candidates.filter(
            (c) => isOnAxis(c.ref.type) && !visited.has(refKey(c.ref))
          )
        : [];

  if (pool.length === 0) return null;

  pool.sort((a, b) => {
    const ai = axisIndex(a.ref.type);
    const bi = axisIndex(b.ref.type);
    if (direction === "up") {
      if (bi !== ai) return bi - ai;
    } else if (bi !== ai) {
      return ai - bi;
    }
    if (b.strength !== a.strength) return b.strength - a.strength;
    return b.updatedAt - a.updatedAt;
  });

  return pool[0] ?? null;
}

function expandAxis(
  start: EntityRef,
  direction: "up" | "down",
  maxSteps: number,
  visited: Set<string>,
  ctx: ThreadContext
): EntityRef[] {
  const chain: EntityRef[] = [];
  let current = start;
  let currentIdx = axisIndex(start.type);

  for (let step = 0; step < maxSteps; step++) {
    const best = pickBestNeighbor(
      getNeighborCandidates(current, ctx),
      direction,
      currentIdx,
      visited
    );
    if (!best) break;
    visited.add(refKey(best.ref));
    chain.push(best.ref);
    current = best.ref;
    currentIdx = axisIndex(current.type);
  }

  return chain;
}

async function loadThreadContext(projectId: string): Promise<ThreadContext> {
  const [
    relations,
    stageRows,
    elementRows,
    kpiRows,
    segmentRows,
    problemRows,
    flowRows,
    pageRows,
    sectionRows,
    channelRows,
    campaignRows,
  ] = await Promise.all([
    listRelations(projectId),
    db
      .select({
        id: purchaseStages.id,
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
      })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))),
    db
      .select({ id: kpis.id, name: kpis.name, segmentId: kpis.segmentId })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({ id: segments.id, name: segments.name })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
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

  const labels = new Map<string, string>();
  for (const s of segmentRows) labels.set(refKey({ type: "segment", id: s.id }), s.name);
  for (const p of problemRows) {
    const short = p.problemMd.split(/[.!?]/)[0]?.trim() ?? p.problemMd;
    labels.set(refKey({ type: "problem", id: p.id }), short.slice(0, 80));
  }
  const stageNameRows = await db
    .select({ id: purchaseStages.id, name: purchaseStages.name })
    .from(purchaseStages)
    .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
    .where(and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt)));
  for (const s of stageNameRows) {
    labels.set(refKey({ type: "stage", id: s.id }), s.name);
  }
  for (const e of elementRows) {
    labels.set(refKey({ type: "element", id: e.id }), e.name);
  }
  for (const k of kpiRows) labels.set(refKey({ type: "kpi", id: k.id }), k.name);
  for (const f of flowRows) labels.set(refKey({ type: "flow", id: f.id }), f.name);
  for (const p of pageRows) labels.set(refKey({ type: "page", id: p.id }), p.name);
  for (const s of sectionRows) {
    labels.set(refKey({ type: "section", id: s.id }), s.name);
  }
  for (const c of channelRows) {
    labels.set(refKey({ type: "channel", id: c.id }), c.name);
  }
  for (const c of campaignRows) {
    labels.set(refKey({ type: "campaign", id: c.id }), c.name);
  }

  const elementToStage = new Map<string, string>();
  for (const e of elementRows) elementToStage.set(e.id, e.stageId);

  const stageToSegment = new Map<string, string>();
  const segmentToStages = new Map<string, string[]>();
  for (const s of stageRows) {
    stageToSegment.set(s.id, s.segmentId);
    const list = segmentToStages.get(s.segmentId) ?? [];
    list.push(s.id);
    segmentToStages.set(s.segmentId, list);
  }

  const stageToElements = new Map<string, string[]>();
  for (const e of elementRows) {
    const list = stageToElements.get(e.stageId) ?? [];
    list.push(e.id);
    stageToElements.set(e.stageId, list);
  }

  const kpiToSegment = new Map<string, string>();
  for (const k of kpiRows) {
    if (k.segmentId) kpiToSegment.set(k.id, k.segmentId);
  }

  return {
    relations,
    labels,
    elementToStage,
    stageToSegment,
    kpiToSegment,
    segmentToStages,
    stageToElements,
  };
}

interface DecisionBundle {
  decision: {
    id: string;
    title: string;
    reasonMd: string | null;
    createdAt: Date;
  };
  links: { entityType: string; entityId: string; role: string }[];
}

function decisionsForEdge(
  bundles: DecisionBundle[],
  a: EntityRef,
  b: EntityRef
): ThreadDecision[] {
  const ak = refKey(a);
  const bk = refKey(b);
  const matched: ThreadDecision[] = [];

  for (const bundle of bundles) {
    const keys = new Set(
      bundle.links.map((l) => `${l.entityType}:${l.entityId}`)
    );
    const hasBoth = keys.has(ak) && keys.has(bk);
    const causeEffect =
      bundle.links.some(
        (l) => l.role === "cause" && l.entityType === a.type && l.entityId === a.id
      ) &&
      bundle.links.some(
        (l) => l.role === "effect" && l.entityType === b.type && l.entityId === b.id
      );
    if (!hasBoth && !causeEffect) continue;
    matched.push({
      id: bundle.decision.id,
      title: bundle.decision.title,
      reasonMd: bundle.decision.reasonMd,
      createdAt: bundle.decision.createdAt.toISOString(),
    });
  }

  matched.sort(
    (x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime()
  );
  return matched.slice(0, MAX_DECISIONS_PER_EDGE);
}

function buildAxisRefs(start: EntityRef, ctx: ThreadContext): EntityRef[] {
  const visited = new Set<string>([refKey(start)]);
  const upstream = expandAxis(start, "up", MAX_AXIS_NODES, visited, ctx);
  upstream.reverse();
  const downstream = expandAxis(start, "down", MAX_AXIS_NODES, visited, ctx);
  let axis = [...upstream, start, ...downstream];

  if (axis.length > MAX_AXIS_NODES) {
    const focusIdx = upstream.length;
    const startIdx = Math.max(
      0,
      Math.min(focusIdx - Math.floor(MAX_AXIS_NODES / 2), axis.length - MAX_AXIS_NODES)
    );
    axis = axis.slice(startIdx, startIdx + MAX_AXIS_NODES);
  }

  axis.sort((a, b) => axisIndex(a.type) - axisIndex(b.type));

  const focusKey = refKey(start);
  if (!axis.some((r) => refKey(r) === focusKey)) {
    axis.push(start);
    axis.sort((a, b) => axisIndex(a.type) - axisIndex(b.type));
    if (axis.length > MAX_AXIS_NODES) {
      const fi = axis.findIndex((r) => refKey(r) === focusKey);
      const startIdx = Math.max(
        0,
        Math.min(fi - Math.floor(MAX_AXIS_NODES / 2), axis.length - MAX_AXIS_NODES)
      );
      axis = axis.slice(startIdx, startIdx + MAX_AXIS_NODES);
    }
  }

  return axis;
}

function filterAxisForClient(
  axis: EntityRef[],
  vis: ProjectVisibility
): EntityRef[] {
  const visible = axis.filter((r) => isEntityVisible(vis, r.type, r.id));
  if (visible.length === axis.length) return visible;

  const bridged: EntityRef[] = [];
  for (let i = 0; i < visible.length; i++) {
    const cur = visible[i];
    bridged.push(cur);
    if (i < visible.length - 1) {
      const next = visible[i + 1];
      const curIdx = axis.findIndex((r) => refKey(r) === refKey(cur));
      const nextIdx = axis.findIndex((r) => refKey(r) === refKey(next));
      if (nextIdx - curIdx > 1) {
        // gap bridged visually via edge label "…" — nodes already omitted
      }
    }
  }
  return bridged;
}

export async function getThread(
  projectId: string,
  ref: EntityRef,
  mode: "editor" | "client"
): Promise<ThreadData> {
  const [ctx, segmentRows, decisionRows, linkRows, vis] = await Promise.all([
    loadThreadContext(projectId),
    db
      .select({ id: segments.id, name: segments.name })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({
        id: strategicDecisions.id,
        title: strategicDecisions.title,
        reasonMd: strategicDecisions.reasonMd,
        createdAt: strategicDecisions.createdAt,
      })
      .from(strategicDecisions)
      .where(
        and(
          eq(strategicDecisions.projectId, projectId),
          isNull(strategicDecisions.deletedAt)
        )
      ),
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
    mode === "client" ? getProjectVisibility(projectId) : Promise.resolve(null),
  ]);

  const fullAxis = buildAxisRefs(ref, ctx);
  let axisRefs = fullAxis;
  if (mode === "client" && vis) {
    axisRefs = filterAxisForClient(fullAxis, vis);
  }

  const fullIndex = new Map(fullAxis.map((r, i) => [refKey(r), i]));

  const bundles: DecisionBundle[] = decisionRows.map((d) => ({
    decision: d,
    links: linkRows
      .filter((l) => l.decisionId === d.id)
      .filter((l) => isEntityTypeKey(l.entityType))
      .map((l) => ({
        entityType: l.entityType,
        entityId: l.entityId,
        role: l.role,
      })),
  }));

  const focusKey = refKey(ref);
  const nodes: ThreadNode[] = axisRefs.map((r) => {
    const meta = ENTITY_TYPE_META[r.type];
    const label =
      ctx.labels.get(refKey(r)) ??
      meta?.label ??
      r.type;
    return {
      ref: r,
      label,
      color: meta?.color ?? "#94a3b8",
      typeLabel: meta?.label ?? r.type,
      isFocus: refKey(r) === focusKey,
      href: meta
        ? `/strategy-hub/projects/${projectId}/constellation?level=entity&type=${r.type}&id=${r.id}`
        : undefined,
    };
  });

  const edges: ThreadEdge[] = [];
  for (let i = 0; i < axisRefs.length - 1; i++) {
    const a = axisRefs[i];
    const b = axisRefs[i + 1];
    const { label, rationaleMd } = edgeLabelBetween(ctx, a, b);
    const ai = fullIndex.get(refKey(a));
    const bi = fullIndex.get(refKey(b));
    const bridged =
      ai !== undefined && bi !== undefined && bi - ai > 1;

    const decisions =
      mode === "client" ? [] : decisionsForEdge(bundles, a, b);

    edges.push({
      from: i,
      to: i + 1,
      relationLabel: bridged ? "…" : label,
      decisions,
      rationaleMd:
        mode === "client" || decisions.length > 0 ? undefined : rationaleMd,
    });
  }

  const segmentNode = axisRefs.find((r) => r.type === "segment");

  return {
    nodes,
    edges,
    segmentId: segmentNode?.id ?? null,
    segments: segmentRows.map((s) => ({ id: s.id, name: s.name })),
  };
}

export type { EntityRef };
