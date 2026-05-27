"use client";

import * as React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavSidebar } from "@/components/strategy-hub/nav-sidebar";
import { StrategyHubHeader } from "@/components/strategy-hub/hub-header";
import {
  ProjectProvider,
  useProjectIdFromPath,
} from "@/components/strategy-hub/project-context";

interface ProjectMeta {
  id: string;
  name: string;
  icon: string | null;
}

function ProjectMetaLoader({ children }: { children: React.ReactNode }) {
  const projectId = useProjectIdFromPath();
  const [project, setProject] = React.useState<ProjectMeta | null>(null);

  React.useEffect(() => {
    if (!projectId) {
      setProject(null);
      return;
    }

    const ctrl = new AbortController();
    fetch(`/api/strategy-hub/projects/${projectId}`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { project?: ProjectMeta } | null) => {
        setProject(data?.project ?? null);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setProject(null);
      });

    return () => ctrl.abort();
  }, [projectId]);

  return <ProjectProvider project={project}>{children}</ProjectProvider>;
}

export function StrategyHubShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectMetaLoader>
      <SidebarProvider>
        <NavSidebar />
        <div className="flex flex-1 flex-col min-h-screen min-w-0">
          <StrategyHubHeader />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </SidebarProvider>
    </ProjectMetaLoader>
  );
}
