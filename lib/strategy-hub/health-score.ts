import "server-only";
import { db } from "@/db";
import {
  businessStrategy,
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
} from "@/db/schema";
import { eq, isNull, and, count } from "drizzle-orm";
import { HEALTH_MODULE_KEYS, findModuleRule } from "./rules/defaults";
import { computeModuleScore, type CriterionContext } from "./rules/evaluate";
import { resolveRules } from "./rules/resolve";
import { projectModuleHref } from "./area-routes";

export interface ModuleHealth {
  key: string;
  label: string;
  /** 0-100 */
  score: number;
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

function buildHint(key: string, ctx: CriterionContext, score: number): string {
  switch (key) {
    case "discovery":
      return `${ctx.qN} pytań · ${ctx.matN} materiałów`;
    case "brand":
      return score >= 100 ? "Kompletna" : "Uzupełnij tożsamość";
    case "business":
      return score >= 100 ? "Gotowa" : "Uzupełnij sekcje";
    case "segments":
      return `${ctx.segN} grup docelowych`;
    case "funnel":
      return `${ctx.chN} kanałów`;
    case "sales":
      return `${ctx.pitchN} pitchów · ${ctx.scriptN} skryptów`;
    case "website":
      return `${ctx.pageN} podstron`;
    case "kpi":
      return `${ctx.kpiN} wskaźników`;
    default:
      return "";
  }
}

/**
 * Liczy „health score" projektu — kompletność danych w każdym module.
 * Kryteria z silnika reguł (`resolveRules`); domyślnie = dotychczasowy hardcode.
 */
export async function computeProjectHealth(
  projectId: string
): Promise<ProjectHealth> {
  const rules = await resolveRules(projectId);

  const [
    strategy,
    identity,
    visual,
    [segCount],
    [chCount],
    [pitchCount],
    [scriptCount],
    [pageCount],
    [kpiCount],
    [qCount],
    [matCount],
  ] = await Promise.all([
    db
      .select()
      .from(businessStrategy)
      .where(eq(businessStrategy.projectId, projectId))
      .limit(1)
      .then((r) => r[0]),
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
    problemCount: 0,
    competitorCount: 0,
    objectionCount: 0,
    stageCount: 0,
    elementCount: 0,
    flowCount: 0,
    leadMagnetCount: 0,
    brandIdentity: identity ?? null,
    brandVisual: visual ?? null,
    businessStrategy: strategy ?? null,
  };

  const modules: ModuleHealth[] = HEALTH_MODULE_KEYS.flatMap((key) => {
    const moduleRule = findModuleRule(rules, key);
    if (!moduleRule) return [];

    const score = computeModuleScore(moduleRule, ctx);
    return [
      {
        key,
        label: moduleRule.label,
        score,
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
