import { redirect, notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { Grid3x3 } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { projects as dbProjects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import { getBlueprint } from "@/lib/strategy-hub/blueprint-data";
import { BlueprintPageLoader } from "@/components/strategy-hub/blueprint/blueprint-page-loader";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-konst",
});

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ segment?: string }>;
}

export default async function ClientBlueprintPage({
  params,
  searchParams,
}: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;
  const query = await searchParams;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }
  if (!project) notFound();

  const rows = await db
    .select({ id: dbProjects.id })
    .from(dbProjects)
    .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
    .limit(1);

  const projectId = rows[0]?.id;
  if (!projectId) notFound();

  trackVisit(projectId, "strategy-blueprint");

  const initialData = await getBlueprint(
    projectId,
    query.segment ?? null,
    "client"
  );

  return (
    <div
      className={`${fraunces.variable} flex min-h-[calc(100dvh-8rem)] flex-col gap-4`}
    >
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Grid3x3 className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">
            Blueprint segmentu
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Macierz etapów zakupu — treści, kanały, strona i KPI wybranego segmentu.
        </p>
      </div>

      <BlueprintPageLoader
        projectId={projectId}
        mode="client"
        initialData={initialData}
        constellationBase={`/projects/${slug}/strategy/constellation`}
      />
    </div>
  );
}
