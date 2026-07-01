import { redirect, notFound } from "next/navigation";
import { Users, Hammer } from "lucide-react";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { projects as dbProjects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
} from "@/lib/strategy-hub/visibility";
import { SegmentsEditor } from "@/app/(strategy-hub)/strategy-hub/projects/[id]/segments/segments-editor";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function ClientSegmentsPage({ params }: Props) {
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

  const [row] = await db
    .select({ id: dbProjects.id })
    .from(dbProjects)
    .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
    .limit(1);
  if (!row) notFound();

  trackVisit(row.id, "segments");
  const vis = await getProjectVisibility(row.id);
  const moduleVis = moduleStatus(vis, "segments");
  if (moduleVis === "hidden") notFound();

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Segmenty</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Grupy docelowe — persona, psychologia zakupu, ścieżka i ryzyka.
        </p>
      </div>

      {moduleVis === "in_progress" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-16 text-center">
          <Hammer className="mx-auto size-10 text-amber-500/50 mb-3" />
          <p className="text-sm text-foreground/90">Ta sekcja jest w budowie.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pracujemy nad nią — wróć wkrótce.
          </p>
        </div>
      ) : (
        <SegmentsEditor
          projectId={row.id}
          projectName={project.name}
          mode="client"
        />
      )}
    </div>
  );
}
