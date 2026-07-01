"use client";

import * as React from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NavSidebar } from "@/components/strategy-hub/nav-sidebar";
import { StrategyHubHeader } from "@/components/strategy-hub/hub-header";
import { ThemeProvider } from "@/components/strategy-hub/theme-provider";
import { HubOverlays } from "@/components/strategy-hub/hub-overlays";
import { AlertsToaster } from "@/components/strategy-hub/alerts-toaster";
import { MobileGate } from "@/components/strategy-hub/mobile-gate";
import { UndoRedoProvider } from "@/components/strategy-hub/undo-redo";
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset przy zmianie/braku projectId z URL
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

function useStrategyHubViewport() {
  React.useEffect(() => {
    document.documentElement.classList.add("strategy-hub-viewport");
    document.body.classList.add("strategy-hub-viewport");
    return () => {
      document.documentElement.classList.remove("strategy-hub-viewport");
      document.body.classList.remove("strategy-hub-viewport");
    };
  }, []);
}

export function StrategyHubShell({ children }: { children: React.ReactNode }) {
  useStrategyHubViewport();

  return (
    <ThemeProvider>
      <ProjectMetaLoader>
        <UndoRedoProvider>
          <HubOverlays>
            <SidebarProvider
              disableMobile
              defaultOpen={false}
              className="fixed inset-0 flex h-svh w-screen overflow-hidden bg-background"
            >
              <NavSidebar />
              <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                <StrategyHubHeader />
                <main className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto p-6">{children}</main>
              </div>
            </SidebarProvider>
            <AlertsToaster />
            <MobileGate />
          </HubOverlays>
        </UndoRedoProvider>
      </ProjectMetaLoader>
    </ThemeProvider>
  );
}
