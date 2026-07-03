import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  segments,
  kpis,
  userFlows,
  funnelElements,
  purchaseStages,
  channels,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { getProjectById } from "@/lib/strategy-hub/context";
import { listRelations } from "@/lib/strategy-hub/relations/store";
import { MarketingDashboard } from "../../marketing/marketing-dashboard";
import { AutoRelationsPanel } from "@/components/strategy-hub/auto-relations-panel";

export const metadata = { title: "Kanały i strategia marketingowa" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChannelsPage({ params }: Props) {
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

  const elementIds = funnelElementList.map((e) => e.id);
  const allRelations = await listRelations(id);
  const channelsByElement: Record<string, string[]> = {};
  for (const r of allRelations) {
    if (
      r.sourceType === "element" &&
      elementIds.includes(r.sourceId) &&
      r.relationType === "publikowany_w" &&
      r.targetType === "channel"
    ) {
      const list = channelsByElement[r.sourceId] ?? [];
      list.push(r.targetId);
      channelsByElement[r.sourceId] = list;
    }
  }

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
    <div className="w-full min-w-0 space-y-6">
      <AutoRelationsPanel projectId={id} />
      <MarketingDashboard
        projectId={id}
        projectName={project.name}
        segments={segmentList}
        kpis={kpiList}
        userFlows={flowList}
        funnelElements={funnelElementsWithChannels}
        channels={channelList}
      />
    </div>
  );
}
