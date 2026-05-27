"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

interface ProjectContextValue {
  id: string;
  name: string;
  icon?: string | null;
}

const ProjectContext = React.createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  project,
  children,
}: {
  project: ProjectContextValue | null;
  children: React.ReactNode;
}) {
  return (
    <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  return React.useContext(ProjectContext);
}

/** Fallback gdy brak providera — wyciąga UUID z pathname */
export function useProjectIdFromPath(): string | undefined {
  const pathname = usePathname();
  const match = pathname.match(/\/strategy-hub\/projects\/([0-9a-f-]{36})/i);
  return match?.[1];
}
