import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { Grid3x3 } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getBlueprint } from "@/lib/strategy-hub/blueprint-data";
import { getDecisionsLedger } from "@/lib/strategy-hub/decisions-ledger";
import { BlueprintPageLoader } from "@/components/strategy-hub/blueprint/blueprint-page-loader";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-konst",
});

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
  return { title: `Blueprint segmentu · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function BlueprintPage({ params, searchParams }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;
  const query = await searchParams;

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) notFound();

  const initialData = await getBlueprint(id, query.segment ?? null, "editor");
  const initialLedger = await getDecisionsLedger(id);

  return (
    <div
      className={`${fraunces.variable} -m-6 flex h-[calc(100dvh-3rem)] min-h-0 flex-col`}
    >
      <div className="sr-only">
        <Grid3x3 aria-hidden className="size-5" />
        <h1>Blueprint segmentu — {project.name}</h1>
      </div>
      <BlueprintPageLoader
        projectId={id}
        mode="editor"
        initialData={initialData}
        initialLedger={initialLedger}
        constellationBase={`/strategy-hub/projects/${id}/constellation`}
      />
    </div>
  );
}
