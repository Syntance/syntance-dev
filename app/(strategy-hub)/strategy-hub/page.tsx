import Link from "next/link";
import { Plus, ArrowRight, Globe, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireStrategyHubAccess, getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktywny",
  paused: "Wstrzymany",
  completed: "Zakończony",
  archived: "Archiwum",
};

const STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  paused: "secondary",
  completed: "outline",
  archived: "secondary",
};

async function getProjects(workspaceId: string) {
  try {
    return await db
      .select()
      .from(projects)
      .where(and(isNull(projects.deletedAt), eq(projects.workspaceId, workspaceId)))
      .orderBy(projects.createdAt);
  } catch {
    return [];
  }
}

export default async function StrategyHubPage() {
  const access = await requireStrategyHubAccess();
  const ws = await getOrCreateWorkspaceForAdmin(access.session.email);
  const allProjects = await getProjects(ws.id);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projekty</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {allProjects.length === 0
              ? "Brak projektów. Utwórz pierwszy."
              : `${allProjects.length} ${allProjects.length === 1 ? "projekt" : "projekty"}`}
          </p>
        </div>
        <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5">
          <Link href="/strategy-hub/projects/new">
            <Plus className="size-4" />
            Nowy projekt
          </Link>
        </Button>
      </div>

      {allProjects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: {
    id: string;
    name: string;
    icon: string | null;
    slug: string;
    status: string;
    domain: string | null;
    clientName: string | null;
    updatedAt: Date;
  };
}) {
  return (
    <Link
      href={`/strategy-hub/projects/${project.id}`}
      className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 hover:border-brand/40 hover:bg-card/80 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
            {project.icon ?? "🏢"}
          </div>
          <div className="min-w-0">
            <h2 className="font-medium text-sm leading-tight truncate">
              {project.name}
            </h2>
            {project.clientName && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {project.clientName}
              </p>
            )}
          </div>
        </div>
        <Badge
          variant={STATUS_COLORS[project.status] ?? "secondary"}
          className="text-[10px] px-1.5 h-4 shrink-0"
        >
          {STATUS_LABELS[project.status] ?? project.status}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {project.domain && (
          <span className="flex items-center gap-1 truncate">
            <Globe className="size-3 shrink-0" />
            <span className="truncate">{project.domain}</span>
          </span>
        )}
        <span className="flex items-center gap-1 ml-auto shrink-0">
          <Calendar className="size-3" />
          {new Date(project.updatedAt).toLocaleDateString("pl-PL", {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>

      <ArrowRight className="absolute right-4 bottom-4 size-4 text-muted-foreground/0 group-hover:text-brand transition-all duration-200 translate-x-0 group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 py-20 text-center">
      <div className="size-14 rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center mb-4">
        <Globe className="size-6 text-brand" />
      </div>
      <h3 className="font-medium text-sm mb-1">Brak projektów</h3>
      <p className="text-xs text-muted-foreground mb-5 max-w-xs">
        Utwórz pierwszy projekt i zacznij budować strategię dla swojego klienta.
      </p>
      <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5">
        <Link href="/strategy-hub/projects/new">
          <Plus className="size-4" />
          Nowy projekt
        </Link>
      </Button>
    </div>
  );
}
