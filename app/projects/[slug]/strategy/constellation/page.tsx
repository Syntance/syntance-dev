import { redirect, notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { Orbit } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { projects as dbProjects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getConstellationScene,
  parseConstellationScene,
} from "@/lib/strategy-hub/constellation-scenes";
import { ConstellationPageLoader } from "@/components/strategy-hub/constellation/constellation-page-loader";

/** Krój display konstelacji — ładowany tylko w tej route. */
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-konst",
});

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    level?: string;
    area?: string;
    type?: string;
    id?: string;
    focus?: string;
  }>;
}

export default async function ClientConstellationPage({
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

  trackVisit(projectId, "strategy-constellation");

  const scene = parseConstellationScene(query);
  const initialScene = await getConstellationScene(projectId, scene, "client");
  const basePath = `/projects/${slug}/strategy/constellation`;

  return (
    <div
      className={`${fraunces.variable} flex min-h-[calc(100dvh-8rem)] flex-col gap-4`}
    >
      <div>
        <div className="mb-1 flex items-center gap-2">
          <Orbit className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Konstelacja</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Pełna mapa strategii — od rdzenia biznesu po pojedyncze elementy lejka
          i strony.
        </p>
      </div>

      <ConstellationPageLoader
        projectId={projectId}
        mode="client"
        basePath={basePath}
        initialScene={initialScene}
        fullscreen
      />
    </div>
  );
}
