import { notFound } from "next/navigation";
import { Map as MapIcon } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getStrategyMapData } from "@/lib/strategy-hub/strategy-map";
import { StrategyMap } from "@/components/strategy-hub/strategy-map/strategy-map";
import { OnboardingWizard } from "@/components/strategy-hub/onboarding-wizard";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ path?: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return { title: `Mapa firmy · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function ProjectMapPage({ params, searchParams }: Props) {
  await requireStrategyHubAccess();
  const { id } = await params;
  const { path } = await searchParams;

  const rows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  const project = rows[0];
  if (!project) notFound();

  const data = await getStrategyMapData(id, path ?? null);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <MapIcon className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Mapa firmy</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Jedna strategia w trzech widokach — Lista, Mapa zależności i Graf
          wpływu. Kliknij węzeł, by rozwinąć podkategorie i karty.
        </p>
      </div>

      <OnboardingWizard projectId={id} />

      <StrategyMap projectId={id} data={data} mode="editor" activePathId={path ?? null} />
    </div>
  );
}
