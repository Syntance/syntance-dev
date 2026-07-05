import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  kpis,
  channels,
  pages,
  campaigns,
  userFlows,
  businessProblems,
  competitors,
  objections,
  offers,
  geoAssets,
  seoKeywords,
  strategicDecisions,
  pageSections,
  sites,
} from "@/db/schema";
import {
  isEntityTypeKey,
  type EntityTypeKey,
} from "@/lib/strategy-hub/entities/entity-types";

export interface SummaryField {
  label: string;
  value: string;
}

export interface EntitySummary {
  fields: SummaryField[];
}

function clip(text: string | null | undefined, max = 220): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function field(label: string, value: string | null | undefined): SummaryField | null {
  const v = value?.trim();
  if (!v) return null;
  return { label, value: v };
}

export async function getEntitySummary(
  projectId: string,
  type: EntityTypeKey,
  id: string
): Promise<EntitySummary> {
  const fields: SummaryField[] = [];

  switch (type) {
    case "segment": {
      const [row] = await db
        .select({
          personaName: segments.personaName,
          code: segments.code,
          problemMd: segments.problemMd,
          jtbdMd: segments.jtbdMd,
          priority: segments.priority,
        })
        .from(segments)
        .where(
          and(
            eq(segments.projectId, projectId),
            eq(segments.id, id),
            isNull(segments.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Persona", row.personaName),
          field("Kod", row.code),
          field("Priorytet", row.priority != null ? String(row.priority) : null),
          field("Problem", clip(row.problemMd)),
          field("JTBD", clip(row.jtbdMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "stage": {
      const [row] = await db
        .select({
          name: purchaseStages.name,
          phase: purchaseStages.phase,
          trigger: purchaseStages.trigger,
          questions: purchaseStages.questions,
        })
        .from(purchaseStages)
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(
          and(
            eq(segments.projectId, projectId),
            eq(purchaseStages.id, id),
            isNull(purchaseStages.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Faza", row.phase),
          field("Trigger", clip(row.trigger)),
          field("Pytania", clip(row.questions)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "element": {
      const [row] = await db
        .select({
          format: funnelElements.format,
          cta: funnelElements.cta,
          ctaUrl: funnelElements.ctaUrl,
          contentMd: funnelElements.contentMd,
          stageName: purchaseStages.name,
        })
        .from(funnelElements)
        .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(
          and(
            eq(segments.projectId, projectId),
            eq(funnelElements.id, id),
            isNull(funnelElements.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Etap", row.stageName),
          field("Format", row.format),
          field("CTA", row.cta),
          field("URL CTA", row.ctaUrl),
          field("Treść", clip(row.contentMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "kpi": {
      const [row] = await db
        .select({
          target: kpis.target,
          actual: kpis.actual,
          unit: kpis.unit,
          category: kpis.category,
          eventKey: kpis.eventKey,
        })
        .from(kpis)
        .where(
          and(eq(kpis.projectId, projectId), eq(kpis.id, id), isNull(kpis.deletedAt))
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Cel", row.target),
          field("Aktualnie", row.actual),
          field("Jednostka", row.unit),
          field("Kategoria", row.category),
          field("Zdarzenie", row.eventKey),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "channel": {
      const [row] = await db
        .select({
          type: channels.type,
          description: channels.description,
          costMonthly: channels.costMonthly,
        })
        .from(channels)
        .where(
          and(
            eq(channels.projectId, projectId),
            eq(channels.id, id),
            isNull(channels.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Typ", row.type),
          field("Koszt / mies.", row.costMonthly != null ? `${row.costMonthly} PLN` : null),
          field("Opis", clip(row.description)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "page": {
      const [row] = await db
        .select({
          urlPath: pages.urlPath,
          type: pages.type,
          goal: pages.goal,
          cta: pages.cta,
          roleInFunnel: pages.roleInFunnel,
        })
        .from(pages)
        .where(
          and(eq(pages.projectId, projectId), eq(pages.id, id), isNull(pages.deletedAt))
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("URL", row.urlPath),
          field("Typ", row.type),
          field("CTA", row.cta),
          field("Rola w lejku", clip(row.roleInFunnel)),
          field("Cel", clip(row.goal)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "flow": {
      const [row] = await db
        .select({
          type: userFlows.type,
          conversionGoal: userFlows.conversionGoal,
          stepsMd: userFlows.stepsMd,
          status: userFlows.status,
        })
        .from(userFlows)
        .where(
          and(
            eq(userFlows.projectId, projectId),
            eq(userFlows.id, id),
            isNull(userFlows.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Typ", row.type),
          field("Status", row.status),
          field("Cel konwersji", clip(row.conversionGoal)),
          field("Kroki", clip(row.stepsMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "campaign": {
      const [row] = await db
        .select({
          stage: campaigns.stage,
          goal: campaigns.goal,
          status: campaigns.status,
          channels: campaigns.channels,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.projectId, projectId),
            eq(campaigns.id, id),
            isNull(campaigns.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        const channelsLabel =
          row.channels != null ? JSON.stringify(row.channels) : null;
        for (const f of [
          field("Etap", row.stage),
          field("Status", row.status),
          field("Kanały", channelsLabel),
          field("Cel", clip(row.goal)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "problem": {
      const [row] = await db
        .select({ problemMd: businessProblems.problemMd, ambitionMd: businessProblems.ambitionMd })
        .from(businessProblems)
        .where(
          and(
            eq(businessProblems.projectId, projectId),
            eq(businessProblems.id, id),
            isNull(businessProblems.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Problem", clip(row.problemMd)),
          field("Ambicja", clip(row.ambitionMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "competitor": {
      const [row] = await db
        .select({
          type: competitors.type,
          url: competitors.url,
          strengthsMd: competitors.strengthsMd,
          weaknessesMd: competitors.weaknessesMd,
          pricingMd: competitors.pricingMd,
        })
        .from(competitors)
        .where(
          and(
            eq(competitors.projectId, projectId),
            eq(competitors.id, id),
            isNull(competitors.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Typ", row.type),
          field("URL", row.url),
          field("Mocne strony", clip(row.strengthsMd)),
          field("Słabe strony", clip(row.weaknessesMd)),
          field("Cennik", clip(row.pricingMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "objection": {
      const [row] = await db
        .select({ objectionMd: objections.objectionMd, responseMd: objections.responseMd })
        .from(objections)
        .where(
          and(
            eq(objections.projectId, projectId),
            eq(objections.id, id),
            isNull(objections.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Obiekcja", clip(row.objectionMd)),
          field("Odpowiedź", clip(row.responseMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "offer": {
      const [row] = await db
        .select({ type: offers.type, uvpMd: offers.uvpMd, pricingMd: offers.pricingMd })
        .from(offers)
        .where(
          and(eq(offers.projectId, projectId), eq(offers.id, id), isNull(offers.deletedAt))
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Typ", row.type),
          field("UVP", clip(row.uvpMd)),
          field("Cennik", clip(row.pricingMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "decision": {
      const [row] = await db
        .select({
          reasonMd: strategicDecisions.reasonMd,
          evidenceMd: strategicDecisions.evidenceMd,
          status: strategicDecisions.status,
        })
        .from(strategicDecisions)
        .where(
          and(
            eq(strategicDecisions.projectId, projectId),
            eq(strategicDecisions.id, id),
            isNull(strategicDecisions.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Status", row.status),
          field("Uzasadnienie", clip(row.reasonMd)),
          field("Dowody", clip(row.evidenceMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "seo_keyword": {
      const [row] = await db
        .select({ phrase: seoKeywords.phrase, intent: seoKeywords.intent })
        .from(seoKeywords)
        .where(
          and(
            eq(seoKeywords.projectId, projectId),
            eq(seoKeywords.id, id),
            isNull(seoKeywords.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [field("Fraza", row.phrase), field("Intencja", row.intent)]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "section": {
      const [row] = await db
        .select({
          ctaText: pageSections.ctaText,
          purposeMd: pageSections.purposeMd,
          copyMd: pageSections.copyMd,
        })
        .from(pageSections)
        .innerJoin(pages, eq(pageSections.pageId, pages.id))
        .where(
          and(
            eq(pages.projectId, projectId),
            eq(pageSections.id, id),
            isNull(pageSections.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("CTA", row.ctaText),
          field("Cel sekcji", clip(row.purposeMd)),
          field("Copy", clip(row.copyMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "site": {
      const [row] = await db
        .select({ domain: sites.domain, type: sites.type, status: sites.status })
        .from(sites)
        .where(
          and(eq(sites.projectId, projectId), eq(sites.id, id), isNull(sites.deletedAt))
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Domena", row.domain),
          field("Typ", row.type),
          field("Status", row.status),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    case "geo": {
      const [row] = await db
        .select({ type: geoAssets.type, status: geoAssets.status, notesMd: geoAssets.notesMd })
        .from(geoAssets)
        .where(
          and(
            eq(geoAssets.projectId, projectId),
            eq(geoAssets.id, id),
            isNull(geoAssets.deletedAt)
          )
        )
        .limit(1);
      if (row) {
        for (const f of [
          field("Typ", row.type),
          field("Status", row.status),
          field("Notatki", clip(row.notesMd)),
        ]) {
          if (f) fields.push(f);
        }
      }
      break;
    }
    default:
      break;
  }

  return { fields };
}

export function parseSummaryType(type: string): EntityTypeKey | null {
  return isEntityTypeKey(type) ? type : null;
}
