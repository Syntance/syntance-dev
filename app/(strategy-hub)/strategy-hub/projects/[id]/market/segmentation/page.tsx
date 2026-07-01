import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { MarketSegmentationEditor } from "@/components/strategy-hub/market-segmentation-editor";

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
  return { title: `Kryteria segmentacji · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function MarketSegmentationPage({ params }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!rows[0]) notFound();

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="size-5 text-brand" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kryteria segmentacji</h1>
          <p className="text-sm text-muted-foreground">
            Wymiary, wg których dzielimy rynek — podstawa do wyznaczania segmentów.
          </p>
        </div>
      </div>
      <MarketSegmentationEditor projectId={id} />
    </div>
  );
}
