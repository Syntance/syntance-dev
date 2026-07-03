"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  List,
  Map as MapIcon,
  Play,
  Loader2,
  Sparkles,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ListView } from "./list-view";
import { MapView } from "./map-view";
import { TrackSwitcher } from "./track-switcher";
import type { StrategyMapData } from "@/lib/strategy-hub/strategy-map-types";

const InfluenceView = dynamic(
  () => import("./influence-view").then((m) => m.InfluenceView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center gap-2 rounded-2xl border border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie grafu…
      </div>
    ),
  }
);

const ConstellationView = dynamic(
  () =>
    import("@/components/strategy-hub/constellation/constellation-view").then(
      (m) => m.ConstellationView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center gap-2 rounded-2xl border border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie konstelacji…
      </div>
    ),
  }
);

const PipelineView = dynamic(
  () =>
    import("@/components/strategy-hub/pipeline/pipeline-view").then(
      (m) => m.PipelineView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[520px] items-center justify-center gap-2 rounded-2xl border border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie pipeline…
      </div>
    ),
  }
);

type View = "list" | "map" | "influence" | "constellation" | "pipeline";

interface StrategyMapProps {
  projectId: string;
  data: StrategyMapData;
  mode: "editor" | "client";
  /** Aktywna ścieżka strategii (z ?path=) — null = wszystkie. */
  activePathId?: string | null;
  initialView?: View;
  initialFocus?: string;
}

function resolveDefaultView(
  mode: "editor" | "client",
  viewParam: string | null | undefined,
  initialView?: View
): View {
  const v = viewParam ?? initialView;
  if (mode === "client") {
    if (v === "map") return "map";
    if (v === "list") return "list";
    if (v === "influence") return "influence";
    return "constellation";
  }
  if (v === "constellation") return "constellation";
  if (v === "pipeline") return "pipeline";
  if (v === "map") return "map";
  if (v === "influence") return "influence";
  return "list";
}

export function StrategyMap({
  projectId,
  data,
  mode,
  activePathId = null,
  initialView,
  initialFocus,
}: StrategyMapProps) {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") ?? initialView;
  const focusParam = searchParams.get("focus") ?? initialFocus ?? undefined;

  const [view, setView] = useState<View>(() =>
    resolveDefaultView(mode, viewParam, initialView)
  );
  const [presentSignal, setPresentSignal] = useState(0);

  const startPresentation = () => {
    setView("map");
    setPresentSignal((n) => n + 1);
  };

  const showViewSwitcher = view !== "influence";

  return (
    <div className="space-y-4">
      {showViewSwitcher && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              role="tablist"
              aria-label="Widoki mapy strategii"
              className="flex rounded-lg border border-border bg-card p-0.5"
            >
              <ToggleBtn
                active={view === "list"}
                onClick={() => setView("list")}
                icon={<List className="size-3.5" />}
                label="Lista"
              />
              <ToggleBtn
                active={view === "map"}
                onClick={() => setView("map")}
                icon={<MapIcon className="size-3.5" />}
                label="Mapa"
              />
              <ToggleBtn
                active={view === "constellation"}
                onClick={() => setView("constellation")}
                icon={<Sparkles className="size-3.5" />}
                label="Konstelacja"
              />
              {mode === "editor" && (
                <ToggleBtn
                  active={view === "pipeline"}
                  onClick={() => setView("pipeline")}
                  icon={<GitBranch className="size-3.5" />}
                  label="Pipeline"
                />
              )}
            </div>
            {mode === "editor" && (
              <TrackSwitcher projectId={projectId} activePathId={activePathId} />
            )}
          </div>

          {mode === "editor" && (
            <button
              type="button"
              onClick={startPresentation}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-(--brand-glow) transition-opacity hover:opacity-90"
            >
              <Play className="size-3.5 fill-current" /> Prezentacja
            </button>
          )}
        </div>
      )}

      {view === "list" && <ListView nodes={data.nodes} mode={mode} />}

      <div className={cn(view === "map" ? "" : "hidden")}>
        <MapView
          projectId={projectId}
          nodes={data.nodes}
          edges={data.edges}
          order={data.presentationOrder}
          mode={mode}
          active={view === "map"}
          presentSignal={presentSignal}
          onOpenInfluence={() => setView("influence")}
        />
      </div>

      {view === "constellation" && (
        <ConstellationView
          projectId={projectId}
          mode={mode}
          initialFocus={focusParam}
        />
      )}

      {view === "pipeline" && mode === "editor" && (
        <PipelineView projectId={projectId} mode={mode} />
      )}

      {view === "influence" && (
        <InfluenceView graph={data.influence} onBack={() => setView("map")} />
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-brand/15 text-brand" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
