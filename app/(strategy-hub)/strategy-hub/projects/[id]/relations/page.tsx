import { notFound } from "next/navigation";
import { Network } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getRelationGraphData } from "@/lib/strategy-hub/relation-graph";
import { RelationGraph } from "@/components/strategy-hub/strategy-map/relation-graph";

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
  return { title: `Graf relacji · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function RelationsPage({ params }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;

  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!rows[0]) notFound();

  const data = await getRelationGraphData(id);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Network className="size-5 text-brand" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Graf relacji projektu</h1>
          <p className="text-sm text-muted-foreground">
            Wszystkie encje projektu jako węzły — kliknij, by zobaczyć szczegóły i
            przejść do edytora.
          </p>
        </div>
      </div>
      <RelationGraph projectId={id} data={data} />
    </div>
  );
}
