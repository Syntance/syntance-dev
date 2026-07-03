import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getProjectById } from "@/lib/strategy-hub/context";
import { ArchiveProjectDialog } from "@/components/strategy-hub/archive-project-dialog";

export const metadata = { title: "Ogólne" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectGeneralSettingsPage({ params }: Props) {
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h2 className="text-sm font-medium">Strefa niebezpieczna</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Archiwizacja ukrywa projekt „{project.name}” z listy projektów i ze
          wszystkich widoków Strategy Hub. To operacja odwracalna — dane
          projektu pozostają w bazie.
        </p>
        <ArchiveProjectDialog projectId={project.id} projectName={project.name} />
      </div>
    </div>
  );
}
