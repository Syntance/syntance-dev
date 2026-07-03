import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import {
  funnelElements,
  funnelElementEvents,
  purchaseStages,
  segments,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { isConversionEvent } from "@/packages/analytics-events/src";
import {
  listRelations,
  createRelation,
  softDeleteRelation,
} from "@/lib/strategy-hub/relations/store";

const schema = z.object({
  channelIds: z.array(z.string().uuid()).optional(),
  kpiIds: z.array(z.string().uuid()).optional(),
  campaignIds: z.array(z.string().uuid()).optional(),
  geoAssetIds: z.array(z.string().uuid()).optional(),
  eventKeys: z.array(z.string().max(100)).optional(),
});

const RELATION_MAP = {
  channelIds: { targetType: "channel" as const, relationType: "publikowany_w" },
  kpiIds: { targetType: "kpi" as const, relationType: "mierzony_przez" },
  campaignIds: { targetType: "campaign" as const, relationType: "promowany_przez" },
  geoAssetIds: { targetType: "geo" as const, relationType: "wspierany_przez" },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id, elementId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const relations = await listRelations(id, {
    entity: { type: "element", id: elementId },
  });

  const channelIds = relations
    .filter((r) => r.relationType === "publikowany_w" && r.targetType === "channel")
    .map((r) => r.targetId);
  const kpiIds = relations
    .filter((r) => r.relationType === "mierzony_przez" && r.targetType === "kpi")
    .map((r) => r.targetId);
  const campaignIds = relations
    .filter(
      (r) => r.relationType === "promowany_przez" && r.targetType === "campaign"
    )
    .map((r) => r.targetId);
  const geoAssetIds = relations
    .filter((r) => r.relationType === "wspierany_przez" && r.targetType === "geo")
    .map((r) => r.targetId);

  const eventRows = await db
    .select({ eventKey: funnelElementEvents.eventKey })
    .from(funnelElementEvents)
    .where(eq(funnelElementEvents.funnelElementId, elementId));

  return NextResponse.json({
    channelIds,
    kpiIds,
    campaignIds,
    geoAssetIds,
    eventKeys: eventRows.map((r) => r.eventKey),
  });
}

async function syncRelationGroup(
  projectId: string,
  elementId: string,
  relationType: string,
  targetType: "channel" | "kpi" | "campaign" | "geo",
  targetIds: string[] | undefined
): Promise<void> {
  if (targetIds === undefined) return;

  const existing = await listRelations(projectId, {
    entity: { type: "element", id: elementId },
  });

  const current = existing.filter(
    (r) =>
      r.sourceType === "element" &&
      r.sourceId === elementId &&
      r.relationType === relationType &&
      r.targetType === targetType
  );

  const desired = new Set(targetIds);
  const currentTargets = new Map(current.map((r) => [r.targetId, r.id]));

  for (const rel of current) {
    if (!desired.has(rel.targetId)) {
      await softDeleteRelation(projectId, rel.id, { userId: null });
    }
  }

  for (const targetId of targetIds) {
    if (!currentTargets.has(targetId)) {
      await createRelation(
        projectId,
        {
          source: { type: "element", id: elementId },
          target: { type: targetType, id: targetId },
          relationType,
        },
        { source: "human", userId: null }
      );
    }
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id: projectId, elementId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [element] = await db
    .select({ id: funnelElements.id })
    .from(funnelElements)
    .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
    .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
    .where(and(eq(funnelElements.id, elementId), eq(segments.projectId, projectId)))
    .limit(1);

  if (!element) {
    return NextResponse.json({ error: "Element not found" }, { status: 404 });
  }

  const { channelIds, kpiIds, campaignIds, geoAssetIds, eventKeys } = parsed.data;

  await syncRelationGroup(
    projectId,
    elementId,
    RELATION_MAP.channelIds.relationType,
    RELATION_MAP.channelIds.targetType,
    channelIds
  );
  await syncRelationGroup(
    projectId,
    elementId,
    RELATION_MAP.kpiIds.relationType,
    RELATION_MAP.kpiIds.targetType,
    kpiIds
  );
  await syncRelationGroup(
    projectId,
    elementId,
    RELATION_MAP.campaignIds.relationType,
    RELATION_MAP.campaignIds.targetType,
    campaignIds
  );
  await syncRelationGroup(
    projectId,
    elementId,
    RELATION_MAP.geoAssetIds.relationType,
    RELATION_MAP.geoAssetIds.targetType,
    geoAssetIds
  );

  if (eventKeys !== undefined) {
    await db.transaction(async (tx) => {
      await tx
        .delete(funnelElementEvents)
        .where(eq(funnelElementEvents.funnelElementId, elementId));
      if (eventKeys.length > 0) {
        await tx.insert(funnelElementEvents).values(
          eventKeys.map((eventKey) => ({
            funnelElementId: elementId,
            eventKey,
            isConversion: isConversionEvent(eventKey),
          }))
        );
      }
    });
  }

  return NextResponse.json({ ok: true });
}
