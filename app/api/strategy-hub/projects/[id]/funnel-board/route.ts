import { NextRequest, NextResponse } from "next/server";
import { requireProjectReadAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  funnelElementChannels,
  channels,
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";

/**
 * Dane dla Funnel Flow Builder (spec: „Płótno z 4 kolumnami TOFU/MOFU/BOFU/
 * Retencja per segment, etapy i elementy jako nody, drag = zmiana stage_id").
 * Jedno wywołanie zamiast N zapytań rozproszonych po komponencie klienckim.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectReadAccess(projectId);
  if (!auth.ok) return auth.response;

  const segmentRows = await db
    .select({ id: segments.id, name: segments.name, orderIdx: segments.orderIdx })
    .from(segments)
    .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
    .orderBy(segments.orderIdx);

  const segmentIds = segmentRows.map((s) => s.id);

  const stageRows = segmentIds.length
    ? await db
        .select({
          id: purchaseStages.id,
          segmentId: purchaseStages.segmentId,
          name: purchaseStages.name,
          phase: purchaseStages.phase,
        })
        .from(purchaseStages)
        .where(
          and(inArray(purchaseStages.segmentId, segmentIds), isNull(purchaseStages.deletedAt))
        )
    : [];

  const stageIds = stageRows.map((s) => s.id);

  const elementRows = stageIds.length
    ? await db
        .select({
          id: funnelElements.id,
          stageId: funnelElements.stageId,
          segmentId: funnelElements.segmentId,
          name: funnelElements.name,
          format: funnelElements.format,
          status: funnelElements.status,
          position: funnelElements.position,
          contentMd: funnelElements.contentMd,
          cta: funnelElements.cta,
          ctaUrl: funnelElements.ctaUrl,
        })
        .from(funnelElements)
        .where(
          and(inArray(funnelElements.stageId, stageIds), isNull(funnelElements.deletedAt))
        )
    : [];

  const elementIds = elementRows.map((e) => e.id);
  const elementChannelRows = elementIds.length
    ? await db
        .select({
          funnelElementId: funnelElementChannels.funnelElementId,
          channelId: funnelElementChannels.channelId,
        })
        .from(funnelElementChannels)
        .where(inArray(funnelElementChannels.funnelElementId, elementIds))
    : [];

  const channelRows = await db
    .select({ id: channels.id, name: channels.name, icon: channels.icon })
    .from(channels)
    .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt)));

  return NextResponse.json({
    segments: segmentRows,
    stages: stageRows,
    elements: elementRows,
    elementChannels: elementChannelRows,
    channels: channelRows,
  });
}
