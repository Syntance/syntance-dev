import { notFound } from "next/navigation";
import { Milestone } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects, segments, buyerJourneyStages } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { BuyerJourneyEditor } from "@/components/strategy-hub/buyer-journey-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return { title: `Customer Journey · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function MarketJourneyPage({ params }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!projectRows[0]) notFound();

  const segmentRows = await db
    .select({ id: segments.id, name: segments.name, code: segments.code })
    .from(segments)
    .where(and(eq(segments.projectId, id), isNull(segments.deletedAt)))
    .orderBy(asc(segments.orderIdx));

  const firstSegmentId = segmentRows[0]?.id ?? null;
  const initialStages = firstSegmentId
    ? await db
        .select()
        .from(buyerJourneyStages)
        .where(
          and(
            eq(buyerJourneyStages.segmentId, firstSegmentId),
            isNull(buyerJourneyStages.deletedAt)
          )
        )
        .orderBy(asc(buyerJourneyStages.orderIdx))
    : [];

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Milestone className="size-5 text-brand" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Customer Journey</h1>
          <p className="text-sm text-muted-foreground">
            Etapy podróży klienta per segment — co robi klient i jaka jest nasza akcja
            na każdym etapie.
          </p>
        </div>
      </div>
      <BuyerJourneyEditor
        projectId={id}
        segments={segmentRows}
        initialSegmentId={firstSegmentId}
        initialStages={initialStages}
      />
    </div>
  );
}
