"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { SceneData } from "@/lib/strategy-hub/constellation-types";

const ConstellationView = dynamic(
  () =>
    import("@/components/strategy-hub/constellation/constellation-view").then(
      (m) => m.ConstellationView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[420px] flex-1 items-center justify-center gap-2 bg-[oklch(0.13_0.02_260)] text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie konstelacji…
      </div>
    ),
  }
);

interface Props {
  projectId: string;
  mode: "editor" | "client";
  initialScene: SceneData;
  basePath?: string;
  fullscreen?: boolean;
}

export function ConstellationPageLoader({
  projectId,
  mode,
  initialScene,
  basePath,
  fullscreen,
}: Props) {
  return (
    <ConstellationView
      projectId={projectId}
      mode={mode}
      initialScene={initialScene}
      basePath={basePath}
      fullscreen={fullscreen}
    />
  );
}
