import type { HealthCriterion, ModuleRule } from "./types";

export interface CriterionContext {
  segN: number;
  chN: number;
  pitchN: number;
  scriptN: number;
  pageN: number;
  kpiN: number;
  qN: number;
  matN: number;
  problemCount: number;
  competitorCount: number;
  objectionCount: number;
  stageCount: number;
  elementCount: number;
  flowCount: number;
  leadMagnetCount: number;
  /** Faza 1 (M1) — dopełnienie macierzy 13 locków ze spec Notion. */
  buyerJourneyStageCount?: number;
  pageSectionCount?: number;
  seoKeywordCount?: number;
  geoAssetCount?: number;
  offerCount?: number;
  campaignCount?: number;
  marketCriteriaFilled?: boolean;
  /** Faza 11 (M3) — reguła mierzalności: udział KPI z ustawionym `event_key` (0–1). */
  kpiMeasurableRatio?: number;
  /** Faza 11 (M3) — udział elementów lejka z CTA, powiązanych z eventem konwersji (0–1). */
  ctaMeasurableRatio?: number;
  brandIdentity?: {
    missionMd?: string | null;
    visionMd?: string | null;
    toneOfVoiceMd?: string | null;
  } | null;
  brandVisual?: unknown;
  businessStrategy?: {
    goalsMd?: string | null;
    uvpMd?: string | null;
    competitorsMd?: string | null;
    objectionsMd?: string | null;
  } | null;
  uvp?: { coreUvpMd?: string | null } | null;
  copyGuidelines?: {
    principlesMd?: string | null;
    doMd?: string | null;
  } | null;
}

function nonEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

function pct(filled: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((filled / total) * 100);
}

function entityCount(entity: string | undefined, ctx: CriterionContext): number {
  if (!entity) return 0;
  const counts: Record<string, number> = {
    segments: ctx.segN,
    channels: ctx.chN,
    salesPitches: ctx.pitchN,
    salesScripts: ctx.scriptN,
    pages: ctx.pageN,
    kpis: ctx.kpiN,
    projectQuestions: ctx.qN,
    projectMaterials: ctx.matN,
    businessProblems: ctx.problemCount,
    competitors: ctx.competitorCount,
    objections: ctx.objectionCount,
    purchaseStages: ctx.stageCount,
    funnelElements: ctx.elementCount,
    userFlows: ctx.flowCount,
    leadMagnets: ctx.leadMagnetCount,
    buyerJourneyStages: ctx.buyerJourneyStageCount ?? 0,
    pageSections: ctx.pageSectionCount ?? 0,
    seoKeywords: ctx.seoKeywordCount ?? 0,
    geoAssets: ctx.geoAssetCount ?? 0,
    offers: ctx.offerCount ?? 0,
    campaigns: ctx.campaignCount ?? 0,
  };
  return counts[entity] ?? 0;
}

function readField(
  entity: string | undefined,
  field: string | undefined,
  ctx: CriterionContext
): string | null | undefined {
  if (!entity || !field) return undefined;
  if (entity === "brandIdentity") {
    const o = ctx.brandIdentity;
    if (!o) return undefined;
    switch (field) {
      case "missionMd":
        return o.missionMd;
      case "visionMd":
        return o.visionMd;
      case "toneOfVoiceMd":
        return o.toneOfVoiceMd;
      default:
        return undefined;
    }
  }
  if (entity === "businessStrategy") {
    const o = ctx.businessStrategy;
    if (!o) return undefined;
    switch (field) {
      case "goalsMd":
        return o.goalsMd;
      case "uvpMd":
        return o.uvpMd;
      case "competitorsMd":
        return o.competitorsMd;
      case "objectionsMd":
        return o.objectionsMd;
      default:
        return undefined;
    }
  }
  if (entity === "uvp") {
    const o = ctx.uvp;
    if (!o) return undefined;
    if (field === "coreUvpMd") return o.coreUvpMd;
    return undefined;
  }
  return undefined;
}

function evaluateCriterion(
  criterion: HealthCriterion,
  ctx: CriterionContext
): number {
  switch (criterion.metric) {
    case "count_gte": {
      const count = entityCount(criterion.entity, ctx);
      const target = criterion.target ?? 1;
      if (count === 0) return 0;
      if (count >= target) return 100;
      return pct(count, target);
    }
    case "field_filled": {
      return nonEmpty(readField(criterion.entity, criterion.field, ctx)) ? 100 : 0;
    }
    case "custom": {
      if (criterion.id === "brand_visual") {
        return ctx.brandVisual ? 100 : 0;
      }
      if (criterion.id === "przekaz_copy") {
        const hasCopy =
          nonEmpty(ctx.copyGuidelines?.principlesMd) ||
          nonEmpty(ctx.copyGuidelines?.doMd);
        return hasCopy ? 100 : 0;
      }
      if (criterion.id === "kryteria_dimensions") {
        return ctx.marketCriteriaFilled ? 100 : 0;
      }
      if (criterion.id === "kpi_measurable") {
        return Math.round((ctx.kpiMeasurableRatio ?? 0) * 100);
      }
      if (criterion.id === "lejek_cta_measurable") {
        return Math.round((ctx.ctaMeasurableRatio ?? 0) * 100);
      }
      return 0;
    }
    case "ratio":
      return 0;
    default:
      return 0;
  }
}

/** Ważona średnia kryteriów modułu (0–100). */
export function computeModuleScore(
  module: ModuleRule,
  ctx: CriterionContext
): number {
  if (module.criteria.length === 0) return 0;
  let weightSum = 0;
  let scoreSum = 0;
  for (const c of module.criteria) {
    weightSum += c.weight;
    scoreSum += evaluateCriterion(c, ctx) * c.weight;
  }
  if (weightSum <= 0) return 0;
  return Math.round(scoreSum / weightSum);
}
