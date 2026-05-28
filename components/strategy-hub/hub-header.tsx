"use client";

import { Search, Sparkles } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useProject } from "@/components/strategy-hub/project-context";
import { useHubOverlays } from "@/components/strategy-hub/hub-overlays";

export function StrategyHubHeader() {
  const project = useProject();
  const { openPalette, openSidekick } = useHubOverlays();

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

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={openPalette}
          aria-label="Otwórz paletę komend (Cmd+K)"
          className="flex items-center gap-2 h-7 rounded-md border border-border/60 bg-card/50 pl-2 pr-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Szukaj</span>
          <kbd className="hidden sm:inline-flex items-center rounded bg-muted px-1 text-[10px] font-mono">
            ⌘K
          </kbd>
        </button>
        {project && (
          <button
            type="button"
            onClick={openSidekick}
            aria-label="Otwórz AI Sidekick (Cmd+J)"
            className="flex items-center gap-1.5 h-7 rounded-md border border-brand/30 bg-brand/10 px-2 text-xs text-brand hover:bg-brand/20 transition-colors"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">AI</span>
            <kbd className="hidden sm:inline-flex items-center rounded bg-brand/15 px-1 text-[10px] font-mono">
              ⌘J
            </kbd>
          </button>
        )}
      </div>
    </header>
  );
}
