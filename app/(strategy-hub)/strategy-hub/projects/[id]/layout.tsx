import { notFound } from "next/navigation";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { NavSidebar } from "@/components/strategy-hub/nav-sidebar";
import { Separator } from "@/components/ui/separator";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProjectLayout({ children, params }: Props) {
  const { id } = await params;

  let project;
  try {
    const rows = await db
      .select({ id: projects.id, name: projects.name, icon: projects.icon })
      .from(projects)
      .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
      .limit(1);
    project = rows[0];
  } catch {
    project = undefined;
  }

  if (!project) notFound();

  return (
    <SidebarProvider>
      <NavSidebar projectId={project.id} projectName={project.name} />
      <div className="flex flex-1 flex-col min-h-screen min-w-0">
        <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">
            Strategy Hub
          </span>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate">
            {project.icon} {project.name}
          </span>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </SidebarProvider>
  );
}
