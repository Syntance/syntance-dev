import { redirect, notFound } from "next/navigation";
import { Map as MapIcon } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { db } from "@/db";
import { projects as dbProjects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import { getProjectVisibility } from "@/lib/strategy-hub/visibility";
import {
  getStrategyMapData,
  applyClientVisibility,
} from "@/lib/strategy-hub/strategy-map";
import { StrategyMap } from "@/components/strategy-hub/strategy-map/strategy-map";
import type { StrategyMapData } from "@/lib/strategy-hub/strategy-map-types";

interface Props {
  params: Promise<{ slug: string }>;
}

async function loadMap(slug: string): Promise<StrategyMapData | null> {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);
    if (!rows[0]) return null;

    const projectId = rows[0].id;
    trackVisit(projectId, "strategy-map");

    const [data, vis] = await Promise.all([
      getStrategyMapData(projectId),
      getProjectVisibility(projectId),
    ]);

    return applyClientVisibility(data, vis.modules);
  } catch {
    return null;
  }
}

export default async function ClientStrategyMapPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }
  if (!project) notFound();

  const data = await loadMap(slug);
  if (!data) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MapIcon className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Mapa strategii</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Interaktywna mapa Twojej strategii. Kliknij węzeł, by rozwinąć
          szczegóły, albo uruchom prezentację, by przejść ją krok po kroku.
        </p>
      </div>

      <StrategyMap data={data} mode="client" />
    </div>
  );
}
