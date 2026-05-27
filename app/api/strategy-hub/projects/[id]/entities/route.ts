import { NextRequest, NextResponse } from "next/server";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  channels,
  kpis,
  pages,
  userFlows,
} from "@/db/schema";
import { eq, and, isNull, ilike, or } from "drizzle-orm";

type EntityType =
  | "segment"
  | "purchase_stage"
  | "funnel_element"
  | "channel"
  | "kpi"
  | "page"
  | "user_flow";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await getStrategyHubAccess();
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as EntityType;
  const q = searchParams.get("q") ?? "";
  const segmentId = searchParams.get("segmentId") ?? undefined;

  if (!type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const searchFilter = q
    ? (col: Parameters<typeof ilike>[0]) => ilike(col, `%${q}%`)
    : null;

  try {
    let results: { id: string; label: string; meta?: string }[] = [];

    switch (type) {
      case "segment": {
        const rows = await db
          .select({ id: segments.id, name: segments.name, priority: segments.priority })
          .from(segments)
          .where(
            and(
              eq(segments.projectId, projectId),
              isNull(segments.deletedAt),
              searchFilter ? searchFilter(segments.name) : undefined
            )
          )
          .limit(20);
        results = rows.map((r) => ({
          id: r.id,
          label: r.name,
          meta: r.priority ? `Priorytet ${r.priority}` : undefined,
        }));
        break;
      }

      case "purchase_stage": {
        const rows = await db
          .select({
            id: purchaseStages.id,
            name: purchaseStages.name,
            phase: purchaseStages.phase,
            segmentId: purchaseStages.segmentId,
          })
          .from(purchaseStages)
          .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
          .where(
            and(
              eq(segments.projectId, projectId),
              isNull(purchaseStages.deletedAt),
              segmentId ? eq(purchaseStages.segmentId, segmentId) : undefined,
              searchFilter ? searchFilter(purchaseStages.name) : undefined
            )
          )
          .limit(30);
        results = rows.map((r) => ({
          id: r.id,
          label: r.name,
          meta: r.phase ?? undefined,
        }));
        break;
      }

      case "funnel_element": {
        const rows = await db
          .select({
            id: funnelElements.id,
            name: funnelElements.name,
            format: funnelElements.format,
            status: funnelElements.status,
          })
          .from(funnelElements)
          .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
          .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
          .where(
            and(
              eq(segments.projectId, projectId),
              isNull(funnelElements.deletedAt),
              segmentId ? eq(funnelElements.segmentId, segmentId) : undefined,
              searchFilter ? searchFilter(funnelElements.name) : undefined
            )
          )
          .limit(30);
        results = rows.map((r) => ({
          id: r.id,
          label: r.name,
          meta: r.format ?? r.status ?? undefined,
        }));
        break;
      }

      case "channel": {
        const rows = await db
          .select({ id: channels.id, name: channels.name, type: channels.type, icon: channels.icon })
          .from(channels)
          .where(
            and(
              eq(channels.projectId, projectId),
              isNull(channels.deletedAt),
              searchFilter
                ? or(searchFilter(channels.name), searchFilter(channels.type!))
                : undefined
            )
          )
          .limit(30);
        results = rows.map((r) => ({
          id: r.id,
          label: r.icon ? `${r.icon} ${r.name}` : r.name,
          meta: r.type ?? undefined,
        }));
        break;
      }

      case "kpi": {
        const rows = await db
          .select({ id: kpis.id, name: kpis.name, category: kpis.category, unit: kpis.unit })
          .from(kpis)
          .where(
            and(
              eq(kpis.projectId, projectId),
              isNull(kpis.deletedAt),
              segmentId ? eq(kpis.segmentId, segmentId) : undefined,
              searchFilter ? searchFilter(kpis.name) : undefined
            )
          )
          .limit(30);
        results = rows.map((r) => ({
          id: r.id,
          label: r.name,
          meta: [r.category, r.unit].filter(Boolean).join(" · ") || undefined,
        }));
        break;
      }

      case "page": {
        const rows = await db
          .select({ id: pages.id, name: pages.name, urlPath: pages.urlPath, roleInFunnel: pages.roleInFunnel })
          .from(pages)
          .where(
            and(
              eq(pages.projectId, projectId),
              isNull(pages.deletedAt),
              searchFilter
                ? or(searchFilter(pages.name), searchFilter(pages.urlPath!))
                : undefined
            )
          )
          .limit(30);
        results = rows.map((r) => ({
          id: r.id,
          label: r.name,
          meta: r.urlPath ?? r.roleInFunnel ?? undefined,
        }));
        break;
      }

      case "user_flow": {
        const rows = await db
          .select({ id: userFlows.id, name: userFlows.name, status: userFlows.status })
          .from(userFlows)
          .where(
            and(
              eq(userFlows.projectId, projectId),
              isNull(userFlows.deletedAt),
              segmentId ? eq(userFlows.segmentId, segmentId) : undefined,
              searchFilter ? searchFilter(userFlows.name) : undefined
            )
          )
          .limit(30);
        results = rows.map((r) => ({
          id: r.id,
          label: r.name,
          meta: r.status ?? undefined,
        }));
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown entity type" }, { status: 400 });
    }

    return NextResponse.json({ results });
  } catch (err) {
    console.error("[entities] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
