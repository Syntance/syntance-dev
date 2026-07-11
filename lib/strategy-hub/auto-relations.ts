import "server-only";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  funnelElements,
  purchaseStages,
  segments,
  channels,
  channelActivityPlan,
  kpis,
  campaigns,
} from "@/db/schema";
import { listRelations, createRelation } from "@/lib/strategy-hub/relations/store";

/**
 * Silnik automatycznego wnioskowania relacji lejka.
 *
 * Idea: użytkownik nie musi ręcznie spinać każdej krawędzi grafu wpływu.
 * Dopasowanie PO KONKRETNYM ETAPIE ZAKUPU (stageId — logika Negacza);
 * faza TOFU/MOFU/BOFU zostaje tylko jako fallback dla rekordów legacy
 * bez przypiętego stage_id:
 *   element → kampania   (ten sam etap / legacy: segment+faza)   „promowany przez"
 *   element → kanał      (aktywność kanału w etapie / legacy)     „publikowany w"
 *   element → KPI        (KPI przypisany do segmentu elementu)    „mierzony przez"
 *
 * Zwracamy WYŁĄCZNIE nowe (jeszcze niepołączone) sugestie + uzasadnienie,
 * żeby pokazać podgląd przed zapisem. Zapis jest addytywny (nie kasuje istniejących).
 */

type RelationKind = "campaign" | "channel" | "kpi";

interface SuggestedTarget {
  kind: RelationKind;
  targetId: string;
  targetLabel: string;
  reason: string;
}

export interface ElementSuggestion {
  elementId: string;
  elementLabel: string;
  segmentLabel: string | null;
  phase: string | null;
  targets: SuggestedTarget[];
}

const PHASE_VALUES = ["TOFU", "MOFU", "BOFU", "retention"] as const;

function normalizePhase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v.startsWith("TOF")) return "TOFU";
  if (v.startsWith("MOF")) return "MOFU";
  if (v.startsWith("BOF")) return "BOFU";
  if (v.startsWith("RET") || raw.toLowerCase().includes("reten")) return "retention";
  return (PHASE_VALUES as readonly string[]).includes(v) ? v : null;
}

interface ElementCtx {
  id: string;
  name: string;
  stageId: string;
  segmentId: string | null;
  segmentLabel: string | null;
  phase: string | null;
}

async function loadElements(projectId: string): Promise<ElementCtx[]> {
  const rows = await db
    .select({
      id: funnelElements.id,
      name: funnelElements.name,
      stageId: funnelElements.stageId,
      elSegmentId: funnelElements.segmentId,
      stageSegmentId: purchaseStages.segmentId,
      phase: purchaseStages.phase,
      segmentName: segments.name,
    })
    .from(funnelElements)
    .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
    .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
    .where(and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt)));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    stageId: r.stageId,
    segmentId: r.elSegmentId ?? r.stageSegmentId ?? null,
    segmentLabel: r.segmentName ?? null,
    phase: normalizePhase(r.phase),
  }));
}

function relationSetKey(
  elementId: string,
  targetType: string,
  targetId: string,
  relationType: string
): string {
  return `${elementId}:${targetType}:${targetId}:${relationType}`;
}

/** Buduje sugestie relacji dla wszystkich elementów lejka projektu. */
export async function suggestFunnelRelations(
  projectId: string
): Promise<ElementSuggestion[]> {
  const elements = await loadElements(projectId);
  if (elements.length === 0) return [];

  const elementIds = new Set(elements.map((e) => e.id));

  const [campaignRows, activityRows, kpiRows, existingRelations] =
    await Promise.all([
      db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          segmentId: campaigns.segmentId,
          stage: campaigns.stage,
          stageId: campaigns.stageId,
        })
        .from(campaigns)
        .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
      db
        .select({
          channelId: channelActivityPlan.channelId,
          channelName: channels.name,
          segmentId: channelActivityPlan.segmentId,
          stage: channelActivityPlan.stage,
          stageId: channelActivityPlan.stageId,
        })
        .from(channelActivityPlan)
        .innerJoin(channels, eq(channelActivityPlan.channelId, channels.id))
        .where(
          and(eq(channels.projectId, projectId), isNull(channelActivityPlan.deletedAt))
        ),
      db
        .select({ id: kpis.id, name: kpis.name, segmentId: kpis.segmentId })
        .from(kpis)
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
      listRelations(projectId),
    ]);

  const hasRelation = new Set<string>();
  for (const rel of existingRelations) {
    if (rel.sourceType !== "element" || !elementIds.has(rel.sourceId)) continue;
    hasRelation.add(
      relationSetKey(rel.sourceId, rel.targetType, rel.targetId, rel.relationType)
    );
  }

  const normalizedCampaigns = campaignRows.map((c) => ({
    ...c,
    phase: normalizePhase(c.stage),
  }));
  const normalizedActivities = activityRows.map((a) => ({
    ...a,
    phase: normalizePhase(a.stage),
  }));

  const suggestions: ElementSuggestion[] = [];

  for (const el of elements) {
    const targets: SuggestedTarget[] = [];

    for (const c of normalizedCampaigns) {
      // Priorytet: konkretny etap zakupu; fallback legacy: segment + faza.
      const stageMatch = c.stageId ? c.stageId === el.stageId : null;
      const segMatch = !c.segmentId || c.segmentId === el.segmentId;
      const phaseMatch = !c.phase || !el.phase || c.phase === el.phase;
      const legacyMatch =
        stageMatch === null && segMatch && phaseMatch && (!!c.segmentId || !!c.phase);
      if (stageMatch === true || legacyMatch) {
        if (
          !hasRelation.has(
            relationSetKey(el.id, "campaign", c.id, "promowany_przez")
          )
        ) {
          targets.push({
            kind: "campaign",
            targetId: c.id,
            targetLabel: c.name,
            reason:
              stageMatch === true
                ? "Ten sam etap zakupu"
                : `Wspólny ${c.segmentId ? "segment" : "etap"}${
                    c.phase ? ` (${c.phase})` : ""
                  }`,
          });
        }
      }
    }

    const seenChannel = new Set<string>();
    for (const a of normalizedActivities) {
      const stageMatch = a.stageId ? a.stageId === el.stageId : null;
      const segMatch = !a.segmentId || a.segmentId === el.segmentId;
      const phaseMatch = !a.phase || !el.phase || a.phase === el.phase;
      const legacyMatch = stageMatch === null && segMatch && phaseMatch;
      if (stageMatch === true || legacyMatch) {
        if (
          !hasRelation.has(
            relationSetKey(el.id, "channel", a.channelId, "publikowany_w")
          ) &&
          !seenChannel.has(a.channelId)
        ) {
          seenChannel.add(a.channelId);
          targets.push({
            kind: "channel",
            targetId: a.channelId,
            targetLabel: a.channelName,
            reason:
              stageMatch === true
                ? "Aktywność kanału w tym etapie zakupu"
                : `Aktywność kanału w ${a.phase ?? "etapie"}${
                    a.segmentId ? " segmentu" : ""
                  }`,
          });
        }
      }
    }

    for (const k of kpiRows) {
      if (k.segmentId && k.segmentId === el.segmentId) {
        if (
          !hasRelation.has(relationSetKey(el.id, "kpi", k.id, "mierzony_przez"))
        ) {
          targets.push({
            kind: "kpi",
            targetId: k.id,
            targetLabel: k.name,
            reason: "KPI przypisany do segmentu",
          });
        }
      }
    }

    if (targets.length > 0) {
      suggestions.push({
        elementId: el.id,
        elementLabel: el.name,
        segmentLabel: el.segmentLabel,
        phase: el.phase,
        targets,
      });
    }
  }

  return suggestions;
}

export interface ApplyRelation {
  elementId: string;
  kind: RelationKind;
  targetId: string;
}

const KIND_TO_RELATION: Record<
  RelationKind,
  { targetType: "campaign" | "channel" | "kpi"; relationType: string }
> = {
  campaign: { targetType: "campaign", relationType: "promowany_przez" },
  channel: { targetType: "channel", relationType: "publikowany_w" },
  kpi: { targetType: "kpi", relationType: "mierzony_przez" },
};

/** Addytywnie zapisuje wybrane relacje (insert brakujących, bez kasowania). */
export async function applyFunnelRelations(
  projectId: string,
  relations: ApplyRelation[]
): Promise<{ inserted: number }> {
  if (relations.length === 0) return { inserted: 0 };

  const validElements = await db
    .select({ id: funnelElements.id })
    .from(funnelElements)
    .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
    .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
    .where(
      and(
        eq(segments.projectId, projectId),
        inArray(
          funnelElements.id,
          relations.map((r) => r.elementId)
        )
      )
    );
  const validElementIds = new Set(validElements.map((e) => e.id));

  let inserted = 0;
  for (const r of relations) {
    if (!validElementIds.has(r.elementId)) continue;
    const mapping = KIND_TO_RELATION[r.kind];
    const row = await createRelation(
      projectId,
      {
        source: { type: "element", id: r.elementId },
        target: { type: mapping.targetType, id: r.targetId },
        relationType: mapping.relationType,
        rationaleMd: "Sugestia auto-relacji (segment + faza)",
      },
      { source: "ai", confidence: 0.85 }
    );
    if (row) inserted += 1;
  }

  return { inserted };
}
