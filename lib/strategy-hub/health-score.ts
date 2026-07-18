import "server-only";
import { db } from "@/db";
import {
  brandIdentity,
  brandVisual,
  segments,
  channels,
  salesPitches,
  salesScripts,
  pages,
  kpis,
  projectQuestions,
  projectMaterials,
  businessProblems,
  uvp,
  competitors,
  objections,
  purchaseStages,
  funnelElements,
  funnelElementEvents,
  userFlows,
  leadMagnets,
  salesActivities,
  copyGuidelines,
} from "@/db/schema";
import { eq, isNull, and, count } from "drizzle-orm";
import { brandPositioning } from "@/db/schema";
import { HEALTH_MODULE_KEYS, findModuleRule } from "./rules/defaults";
import { computeModuleScore, type CriterionContext } from "./rules/evaluate";
import { resolveRules } from "./rules/resolve";
import { resolveStatusesFromContext, type ModuleState } from "./rules/state";
import { projectModuleHref } from "./area-routes";
import { computeProjectCoverage, coverageRatio } from "./journey-coverage";
import { pluralCount } from "./pluralize";

interface ModuleHealth {
  key: string;
  label: string;
  /** 0-100 */
  score: number;
  /**
   * Stan modułu z maszyny stanów (próg gotowości z reguł, nie hardcode).
   * Sidebar koloruje kropki po `state`, nie po score.
   */
  state: ModuleState;
  /** Krótki opis stanu dla użytkownika. */
  hint: string;
  href: string;
}

export interface ProjectHealth {
  /** 0-100 ważona średnia modułów. */
  score: number;
  modules: ModuleHealth[];
}

function moduleHref(projectId: string, key: (typeof HEALTH_MODULE_KEYS)[number]): string {
  return projectModuleHref(projectId, key);
}

function gapSuffix(gaps: number): string {
  return gaps > 0 ? ` · ${pluralCount(gaps, "luka", "luki", "luk")}` : "";
}

function buildHint(key: string, ctx: CriterionContext, score: number): string {
  switch (key) {
    case "discovery":
      return `${pluralCount(ctx.qN, "pytanie", "pytania", "pytań")} · ${pluralCount(ctx.matN, "materiał", "materiały", "materiałów")}`;
    case "brand":
      return score >= 100 ? "Kompletna" : "Uzupełnij tożsamość";
    case "fundament":
      return `${pluralCount(ctx.problemCount, "problem", "problemy", "problemów")} · ${pluralCount(ctx.competitorCount, "konkurent", "konkurentów", "konkurentów")} · ${pluralCount(ctx.objectionCount, "obiekcja", "obiekcje", "obiekcji")}`;
    case "segmenty":
      return pluralCount(ctx.segN, "grupa docelowa", "grupy docelowe", "grup docelowych");
    case "lejek":
      return `${pluralCount(ctx.stageCount, "etap", "etapy", "etapów")} · ${pluralCount(ctx.elementCount, "element", "elementy", "elementów")}${gapSuffix(ctx.journeyGapCount ?? 0)}`;
    case "kanaly":
      return `${pluralCount(ctx.chN, "kanał", "kanały", "kanałów")} · pokrycie etapów ${Math.round((ctx.journeyChannelCoverage ?? 0) * 100)}%`;
    case "przekaz":
      return `${pluralCount(ctx.pitchN, "pitch", "pitche", "pitchów")} · ${pluralCount(ctx.scriptN, "skrypt", "skrypty", "skryptów")}`;
    case "sprzedaz":
      return `${pluralCount(ctx.salesActivityCount ?? 0, "akcja", "akcje", "akcji")} · pokrycie etapów ${Math.round((ctx.journeySalesCoverage ?? 0) * 100)}%`;
    case "strona":
      return pluralCount(ctx.pageN, "podstrona", "podstrony", "podstron");
    case "kpi":
      return `${pluralCount(ctx.kpiN, "wskaźnik", "wskaźniki", "wskaźników")} · pokrycie etapów ${Math.round((ctx.journeyKpiCoverage ?? 0) * 100)}%`;
    default:
      return "";
  }
}

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Liczy „health score" projektu — kompletność danych w każdym module.
 * Kryteria z silnika reguł (`resolveRules`); domyślnie = dotychczasowy hardcode.
 */
export async function computeProjectHealth(
  projectId: string
): Promise<ProjectHealth> {
  // Gap engine podróży zakupowej — jedno źródło prawdy o kompletności maszyny
  // (Journey/Canvas/Pipeline liczą z tego samego; audyt 2026-07-17).
  const [rules, journey] = await Promise.all([
    resolveRules(projectId),
    computeProjectCoverage(projectId),
  ]);

  // Kontekst kryteriów — te same tabele i filtry co `strategy-map.ts`
  // (jedna taksonomia = health i mapa liczą z tych samych danych).
  const [
    identity,
    visual,
    uvpRow,
    copyRow,
    positioningRow,
    [segCount],
    [chCount],
    [pitchCount],
    [scriptCount],
    [pageCount],
    [kpiCount],
    kpiEventRows,
    [qCount],
    [matCount],
    [problemCount],
    [competitorCount],
    [objectionCount],
    [stageCount],
    [flowCount],
    [leadMagnetCount],
    [salesActivityCount],
    elementRows,
    elEventRows,
  ] = await Promise.all([
    db
      .select()
      .from(brandIdentity)
      .where(eq(brandIdentity.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(brandVisual)
      .where(eq(brandVisual.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db.select().from(uvp).where(eq(uvp.projectId, projectId)).limit(1).then((r) => r[0]),
    db
      .select()
      .from(copyGuidelines)
      .where(eq(copyGuidelines.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        statementMd: brandPositioning.statementMd,
        nicheMd: brandPositioning.nicheMd,
        antiIcpMd: brandPositioning.antiIcpMd,
      })
      .from(brandPositioning)
      .where(eq(brandPositioning.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ count: count() })
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select({ count: count() })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select({ count: count() })
      .from(salesPitches)
      .where(
        and(eq(salesPitches.projectId, projectId), isNull(salesPitches.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(salesScripts)
      .where(
        and(eq(salesScripts.projectId, projectId), isNull(salesScripts.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(pages)
      .where(and(eq(pages.projectId, projectId), isNull(pages.deletedAt))),
    db
      .select({ count: count() })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({ eventKey: kpis.eventKey })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select({ count: count() })
      .from(projectQuestions)
      .where(
        and(
          eq(projectQuestions.projectId, projectId),
          isNull(projectQuestions.deletedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(projectMaterials)
      .where(
        and(
          eq(projectMaterials.projectId, projectId),
          isNull(projectMaterials.deletedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(businessProblems)
      .where(
        and(
          eq(businessProblems.projectId, projectId),
          isNull(businessProblems.deletedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(competitors)
      .where(
        and(eq(competitors.projectId, projectId), isNull(competitors.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(objections)
      .where(and(eq(objections.projectId, projectId), isNull(objections.deletedAt))),
    db
      .select({ count: count() })
      .from(purchaseStages)
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(eq(segments.projectId, projectId), isNull(purchaseStages.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(userFlows)
      .where(and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))),
    db
      .select({ count: count() })
      .from(leadMagnets)
      .where(
        and(eq(leadMagnets.projectId, projectId), isNull(leadMagnets.deletedAt))
      ),
    db
      .select({ count: count() })
      .from(salesActivities)
      .innerJoin(purchaseStages, eq(salesActivities.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(eq(segments.projectId, projectId), isNull(salesActivities.deletedAt))
      ),
    db
      .select({ id: funnelElements.id, cta: funnelElements.cta })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(eq(segments.projectId, projectId), isNull(funnelElements.deletedAt))
      ),
    db.select().from(funnelElementEvents),
  ]);

  const ctx: CriterionContext = {
    segN: segCount?.count ?? 0,
    chN: chCount?.count ?? 0,
    pitchN: pitchCount?.count ?? 0,
    scriptN: scriptCount?.count ?? 0,
    pageN: pageCount?.count ?? 0,
    kpiN: kpiCount?.count ?? 0,
    qN: qCount?.count ?? 0,
    matN: matCount?.count ?? 0,
    problemCount: problemCount?.count ?? 0,
    competitorCount: competitorCount?.count ?? 0,
    objectionCount: objectionCount?.count ?? 0,
    stageCount: stageCount?.count ?? 0,
    elementCount: elementRows.length,
    flowCount: flowCount?.count ?? 0,
    leadMagnetCount: leadMagnetCount?.count ?? 0,
    salesActivityCount: salesActivityCount?.count ?? 0,
    brandIdentity: identity ?? null,
    brandVisual: visual ?? null,
    uvp: uvpRow ?? null,
    copyGuidelines: copyRow ?? null,
    positioning: positioningRow
      ? {
          positioningStatement: positioningRow.statementMd,
          nicheMd: positioningRow.nicheMd,
          antiIcpMd: positioningRow.antiIcpMd,
        }
      : null,
    journeyContentCoverage: coverageRatio(journey, ["content"]),
    journeyChannelCoverage: coverageRatio(journey, ["channel"]),
    journeySalesCoverage: coverageRatio(journey, ["sales"]),
    journeyExitCoverage: coverageRatio(journey, ["exit"]),
    journeyKpiCoverage: coverageRatio(journey, ["kpi"]),
    journeyGapCount: journey.gapCount,
    kpiMeasurableRatio:
      kpiEventRows.length > 0
        ? kpiEventRows.filter((k) => !!k.eventKey).length / kpiEventRows.length
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

  const statuses = resolveStatusesFromContext(rules, ctx);

  const modules: ModuleHealth[] = HEALTH_MODULE_KEYS.flatMap((key) => {
    const moduleRule = findModuleRule(rules, key);
    if (!moduleRule) return [];

    const score = computeModuleScore(moduleRule, ctx);
    return [
      {
        key,
        label: moduleRule.label,
        score,
        state: statuses.get(key)?.state ?? "empty",
        hint: buildHint(key, ctx, score),
        href: moduleHref(projectId, key),
      },
    ];
  });

  const overall = Math.round(
    modules.reduce((acc, m) => acc + m.score, 0) / modules.length
  );

  return { score: overall, modules };
}
