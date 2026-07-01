import { NextRequest, NextResponse } from "next/server";
import { and, eq, ilike, isNull, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  channels,
  kpis,
  pages,
  userFlows,
  campaigns,
  geoAssets,
  offers,
} from "@/db/schema";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";
import { EVENT_REGISTRY, EVENT_CATEGORY_LABELS } from "@/packages/analytics-events/src";

interface Result {
  id: string;
  label: string;
  meta?: string | null;
}

const LIMIT = 20;

/**
 * Uniwersalna wyszukiwarka encji dla <RelationPicker />.
 * GET /entities?type=segment&q=...&segmentId=...
 *
 * Każdy typ enkapsuluje własne zapytanie (konkretne kolumny) — type-safe.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const segmentId = searchParams.get("segmentId") ?? undefined;
  const stageId = searchParams.get("stageId") ?? undefined;
  const phase = searchParams.get("phase") ?? undefined;
  const like = q ? `%${q}%` : "%";

  let results: Result[] = [];

  switch (type) {
    case "segment":
      results = await db
        .select({ id: segments.id, label: segments.name, meta: segments.code })
        .from(segments)
        .where(
          and(
            eq(segments.projectId, projectId),
            isNull(segments.deletedAt),
            ilike(segments.name, like)
          )
        )
        .limit(LIMIT);
      break;

    case "channel":
      results = await db
        .select({ id: channels.id, label: channels.name, meta: channels.type })
        .from(channels)
        .where(
          and(
            eq(channels.projectId, projectId),
            isNull(channels.deletedAt),
            ilike(channels.name, like)
          )
        )
        .limit(LIMIT);
      break;

    case "kpi": {
      const filters: SQL[] = [
        eq(kpis.projectId, projectId),
        isNull(kpis.deletedAt),
        ilike(kpis.name, like),
      ];
      if (segmentId) filters.push(eq(kpis.segmentId, segmentId));
      results = await db
        .select({ id: kpis.id, label: kpis.name, meta: kpis.category })
        .from(kpis)
        .where(and(...filters))
        .limit(LIMIT);
      break;
    }

    case "page":
      results = await db
        .select({ id: pages.id, label: pages.name, meta: pages.urlPath })
        .from(pages)
        .where(
          and(
            eq(pages.projectId, projectId),
            isNull(pages.deletedAt),
            ilike(pages.name, like)
          )
        )
        .limit(LIMIT);
      break;

    case "user_flow": {
      const filters: SQL[] = [
        eq(userFlows.projectId, projectId),
        isNull(userFlows.deletedAt),
        ilike(userFlows.name, like),
      ];
      if (segmentId) filters.push(eq(userFlows.segmentId, segmentId));
      results = await db
        .select({ id: userFlows.id, label: userFlows.name, meta: userFlows.type })
        .from(userFlows)
        .where(and(...filters))
        .limit(LIMIT);
      break;
    }

    case "purchase_stage": {
      const filters: SQL[] = [
        eq(segments.projectId, projectId),
        isNull(purchaseStages.deletedAt),
        ilike(purchaseStages.name, like),
      ];
      if (segmentId) filters.push(eq(purchaseStages.segmentId, segmentId));
      if (phase) filters.push(eq(purchaseStages.phase, phase));
      results = await db
        .select({
          id: purchaseStages.id,
          label: purchaseStages.name,
          meta: purchaseStages.phase,
        })
        .from(purchaseStages)
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(...filters))
        .limit(LIMIT);
      break;
    }

    case "funnel_element": {
      const filters: SQL[] = [
        eq(segments.projectId, projectId),
        isNull(funnelElements.deletedAt),
        ilike(funnelElements.name, like),
      ];
      if (segmentId) filters.push(eq(funnelElements.segmentId, segmentId));
      if (stageId) filters.push(eq(funnelElements.stageId, stageId));
      results = await db
        .select({
          id: funnelElements.id,
          label: funnelElements.name,
          meta: purchaseStages.name,
        })
        .from(funnelElements)
        .innerJoin(
          purchaseStages,
          eq(funnelElements.stageId, purchaseStages.id)
        )
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(...filters))
        .limit(LIMIT);
      break;
    }

    case "campaign":
      results = await db
        .select({ id: campaigns.id, label: campaigns.name, meta: campaigns.stage })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.projectId, projectId),
            isNull(campaigns.deletedAt),
            ilike(campaigns.name, like)
          )
        )
        .limit(LIMIT);
      break;

    case "geo":
      results = await db
        .select({ id: geoAssets.id, label: geoAssets.type, meta: geoAssets.status })
        .from(geoAssets)
        .where(
          and(
            eq(geoAssets.projectId, projectId),
            isNull(geoAssets.deletedAt),
            ilike(geoAssets.type, like)
          )
        )
        .limit(LIMIT);
      break;

    case "analytics_event":
      results = EVENT_REGISTRY.filter(
        (e) =>
          !q ||
          e.label.toLowerCase().includes(q.toLowerCase()) ||
          e.key.toLowerCase().includes(q.toLowerCase())
      )
        .slice(0, LIMIT)
        .map((e) => ({
          id: e.key,
          label: e.label,
          meta: `${EVENT_CATEGORY_LABELS[e.category]}${e.isConversion ? " · konwersja" : ""}`,
        }));
      break;

    case "offer":
      results = await db
        .select({ id: offers.id, label: offers.name, meta: offers.type })
        .from(offers)
        .where(
          and(
            eq(offers.projectId, projectId),
            isNull(offers.deletedAt),
            ilike(offers.name, like)
          )
        )
        .limit(LIMIT);
      break;

    default:
      return badRequest(`Unknown entity type: ${type}`);
  }

  return NextResponse.json({
    results: results.map((r) => ({
      id: r.id,
      label: r.label,
      meta: r.meta ?? undefined,
    })),
  });
}
