import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { Orbit } from "lucide-react";
import { requireStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import {
  getConstellationScene,
  parseConstellationScene,
} from "@/lib/strategy-hub/constellation-scenes";
import { ConstellationPageLoader } from "@/components/strategy-hub/constellation/constellation-page-loader";

/** Krój display konstelacji — ładowany tylko w tej route (budżet JS globalu bez zmian). */
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400"],
  display: "swap",
  variable: "--font-konst",
});

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    level?: string;
    area?: string;
    type?: string;
    id?: string;
    entityType?: string;
    entityId?: string;
    focus?: string;
  }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const rows = await db
    .select({ name: projects.name })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  return { title: `Konstelacja · ${rows[0]?.name ?? "Projekt"}` };
}

export default async function ConstellationPage({ params, searchParams }: Props) {
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

  const scene = parseConstellationScene(query);
  const initialScene = await getConstellationScene(id, scene, "editor");

  return (
    <div
      className={`${fraunces.variable} -m-6 flex h-[calc(100dvh-3rem)] min-h-0 flex-col`}
    >
      <div className="sr-only">
        <Orbit aria-hidden className="size-5" />
        <h1>Konstelacja — {project.name}</h1>
      </div>
      <ConstellationPageLoader
        projectId={id}
        mode="editor"
        initialScene={initialScene}
        fullscreen
      />
    </div>
  );
}
