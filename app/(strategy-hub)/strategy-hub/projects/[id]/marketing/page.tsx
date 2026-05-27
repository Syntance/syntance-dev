import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  segments,
  kpis,
  userFlows,
  funnelElements,
  purchaseStages,
  channels,
  funnelElementChannels,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { getProjectById } from "@/lib/strategy-hub/context";
import { MarketingDashboard } from "./marketing-dashboard";

export const metadata = { title: "Strategia marketingowa" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MarketingPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  const [segmentList, kpiList, flowList, funnelElementList, channelList] =
    await Promise.all([
      db
        .select()
        .from(segments)
        .where(and(eq(segments.projectId, id), isNull(segments.deletedAt)))
        .orderBy(asc(segments.priority)),
      db
        .select()
        .from(kpis)
        .where(and(eq(kpis.projectId, id), isNull(kpis.deletedAt))),
      db
        .select()
        .from(userFlows)
        .where(and(eq(userFlows.projectId, id), isNull(userFlows.deletedAt))),
      db
        .select({
          id: funnelElements.id,
          stageId: funnelElements.stageId,
          segmentId: funnelElements.segmentId,
          name: funnelElements.name,
          format: funnelElements.format,
          status: funnelElements.status,
          contentMd: funnelElements.contentMd,
          ctaText: funnelElements.cta,
          ctaUrl: funnelElements.ctaUrl,
          position: funnelElements.position,
          stageName: purchaseStages.name,
          stagePhase: purchaseStages.phase,
        })
        .from(funnelElements)
        .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(and(eq(segments.projectId, id), isNull(funnelElements.deletedAt)))
        .orderBy(asc(funnelElements.position)),
      db
        .select()
        .from(channels)
        .where(and(eq(channels.projectId, id), isNull(channels.deletedAt))),
    ]);

  // Attach channelIds to each funnel element
  const elementIds = funnelElementList.map((e) => e.id);
  const elementChannelRows =
    elementIds.length > 0
      ? await db
          .select()
          .from(funnelElementChannels)
          .where(
            elementIds.length === 1
              ? eq(funnelElementChannels.funnelElementId, elementIds[0])
              : eq(funnelElementChannels.funnelElementId, elementIds[0])
          )
      : [];

  const channelsByElement: Record<string, string[]> = {};
  elementChannelRows.forEach((r) => {
    if (!channelsByElement[r.funnelElementId])
      channelsByElement[r.funnelElementId] = [];
    channelsByElement[r.funnelElementId].push(r.channelId);
  });

  const funnelElementsWithChannels = funnelElementList.map((e) => ({
    ...e,
    channelIds: channelsByElement[e.id] ?? [],
    kpiIds: [] as string[],
    ctaText: e.ctaText ?? "",
    ctaUrl: e.ctaUrl ?? "",
    format: e.format ?? "Post",
    status: e.status ?? "draft",
    contentMd: e.contentMd ?? "",
  }));

  return (
    <MarketingDashboard
      projectId={id}
      projectName={project.name}
      segments={segmentList}
      kpis={kpiList}
      userFlows={flowList}
      funnelElements={funnelElementsWithChannels}
      channels={channelList}
    />
  );
}
