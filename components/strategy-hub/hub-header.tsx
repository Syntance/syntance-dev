"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useProject } from "@/components/strategy-hub/project-context";

export function StrategyHubHeader() {
  const project = useProject();

  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-4" />
      <span className="text-sm font-medium text-muted-foreground">
        Strategy Hub
      </span>
      {project && (
        <>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium truncate">
            {project.icon ? `${project.icon} ` : ""}
            {project.name}
          </span>
        </>
      )}
    </header>
  );
}
