import { NextRequest, NextResponse } from "next/server";
import { requireProjectReadAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import {
  segments,
  purchaseStages,
  funnelElements,
  channels,
  campaigns,
  leadMagnets,
} from "@/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { listRelations } from "@/lib/strategy-hub/relations/store";

/**
 * Dane dla Funnel Board 2.0 (logika Negacza): kolumny = etapy zakupu wybranego
 * segmentu (purchaseStages wg orderIdx), elementy jako nody, drag = zmiana
 * stage_id wprost. Szyny: kanały (publikowany_w), kampanie (promowany_przez),
 * lead magnety (uzywany_w_etapie), wyjścia elementów (prowadzi_do_etapu).
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
          orderIdx: purchaseStages.orderIdx,
          ownerSide: purchaseStages.ownerSide,
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

  const relations = await listRelations(projectId);
  const elementChannelRows = relations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "channel" &&
        r.relationType === "publikowany_w"
    )
    .map((r) => ({
      funnelElementId: r.sourceId,
      channelId: r.targetId,
    }));
  const elementCampaignRows = relations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "campaign" &&
        r.relationType === "promowany_przez"
    )
    .map((r) => ({ funnelElementId: r.sourceId, campaignId: r.targetId }));
  const magnetStageRows = relations
    .filter(
      (r) =>
        r.sourceType === "lead_magnet" &&
        r.targetType === "stage" &&
        r.relationType === "uzywany_w_etapie"
    )
    .map((r) => ({ leadMagnetId: r.sourceId, stageId: r.targetId }));
  const elementNextStageRows = relations
    .filter(
      (r) =>
        r.sourceType === "element" &&
        r.targetType === "stage" &&
        r.relationType === "prowadzi_do_etapu"
    )
    .map((r) => ({ funnelElementId: r.sourceId, stageId: r.targetId }));

  const [channelRows, campaignRows, leadMagnetRows] = await Promise.all([
    db
      .select({ id: channels.id, name: channels.name, icon: channels.icon })
      .from(channels)
      .where(and(eq(channels.projectId, projectId), isNull(channels.deletedAt))),
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        segmentId: campaigns.segmentId,
        stageId: campaigns.stageId,
      })
      .from(campaigns)
      .where(and(eq(campaigns.projectId, projectId), isNull(campaigns.deletedAt))),
    db
      .select({
        id: leadMagnets.id,
        name: leadMagnets.name,
        segmentId: leadMagnets.segmentId,
      })
      .from(leadMagnets)
      .where(and(eq(leadMagnets.projectId, projectId), isNull(leadMagnets.deletedAt))),
  ]);

  return NextResponse.json({
    segments: segmentRows,
    stages: stageRows,
    elements: elementRows,
    elementChannels: elementChannelRows,
    elementCampaigns: elementCampaignRows,
    magnetStages: magnetStageRows,
    elementNextStages: elementNextStageRows,
    channels: channelRows,
    campaigns: campaignRows,
    leadMagnets: leadMagnetRows,
  });
}
