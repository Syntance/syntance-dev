import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import {
  funnelElements,
  funnelElementChannels,
  funnelElementKpis,
  purchaseStages,
  segments,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  channelIds: z.array(z.string().uuid()).optional(),
  kpiIds: z.array(z.string().uuid()).optional(),
});

// GET current relations for an element
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id, elementId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const [channelRows, kpiRows] = await Promise.all([
    db
      .select({ channelId: funnelElementChannels.channelId })
      .from(funnelElementChannels)
      .where(eq(funnelElementChannels.funnelElementId, elementId)),
    db
      .select({ kpiId: funnelElementKpis.kpiId })
      .from(funnelElementKpis)
      .where(eq(funnelElementKpis.funnelElementId, elementId)),
  ]);

  return NextResponse.json({
    channelIds: channelRows.map((r) => r.channelId),
    kpiIds: kpiRows.map((r) => r.kpiId),
  });
}

// PUT replaces all relations atomically
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id: projectId, elementId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Verify element belongs to project
  const [element] = await db
    .select({ id: funnelElements.id })
    .from(funnelElements)
    .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
    .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
    .where(
      and(
        eq(funnelElements.id, elementId),
        eq(segments.projectId, projectId)
      )
    )
    .limit(1);

  if (!element) {
    return NextResponse.json({ error: "Element not found" }, { status: 404 });
  }

  const { channelIds, kpiIds } = parsed.data;

  await db.transaction(async (tx) => {
    if (channelIds !== undefined) {
      await tx
        .delete(funnelElementChannels)
        .where(eq(funnelElementChannels.funnelElementId, elementId));
      if (channelIds.length > 0) {
        await tx.insert(funnelElementChannels).values(
          channelIds.map((channelId) => ({ funnelElementId: elementId, channelId }))
        );
      }
    }

    if (kpiIds !== undefined) {
      await tx
        .delete(funnelElementKpis)
        .where(eq(funnelElementKpis.funnelElementId, elementId));
      if (kpiIds.length > 0) {
        await tx.insert(funnelElementKpis).values(
          kpiIds.map((kpiId) => ({ funnelElementId: elementId, kpiId }))
        );
      }
    }
  });

  return NextResponse.json({ ok: true });
}
