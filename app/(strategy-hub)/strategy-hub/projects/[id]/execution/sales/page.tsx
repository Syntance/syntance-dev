import { notFound } from "next/navigation";
import { Handshake } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getSalesBoard } from "@/lib/strategy-hub/sales-board-data";
import { SalesProcessBoard } from "@/components/strategy-hub/sales-process-board";

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
  return { title: `Proces sprzedaży · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function ExecutionSalesPage({ params, searchParams }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;
  const { segment } = await searchParams;

  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!projectRows[0]) notFound();

  const initialData = await getSalesBoard(id, segment ?? null);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Handshake className="size-5 text-brand" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Proces sprzedaży
          </h1>
          <p className="text-sm text-muted-foreground">
            Lustro podróży zakupowej — co robi handlowiec, gdy klient jest na
            danym etapie, i czym to robi (pitche, skrypty, magnety).
          </p>
        </div>
      </div>
      <SalesProcessBoard projectId={id} initialData={initialData} />
    </div>
  );
}
