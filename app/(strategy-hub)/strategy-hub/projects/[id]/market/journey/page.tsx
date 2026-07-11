import { notFound } from "next/navigation";
import { Milestone } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getJourneyView } from "@/lib/strategy-hub/journey-data";
import { JourneyDesigner } from "@/components/strategy-hub/journey-designer";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ segment?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return { title: `Podróż zakupowa · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function MarketJourneyPage({ params, searchParams }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;
  const { segment } = await searchParams;

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!projectRows[0]) notFound();

  const initialView = await getJourneyView(id, segment ?? null);

  return (
    <div className="flex h-full min-h-[540px] w-full min-w-0 flex-col gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <Milestone className="size-5 text-brand" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Podróż zakupowa
          </h1>
          <p className="text-sm text-muted-foreground">
            Kręgosłup strategii segmentu — z tych etapów wynikają kolumny lejka,
            procesu sprzedaży i blueprintu.
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <JourneyDesigner projectId={id} initialView={initialView} />
      </div>
    </div>
  );
}
