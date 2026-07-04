"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
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

type View = "list" | "map" | "influence" | "pipeline";

interface StrategyMapProps {
  projectId: string;
  data: StrategyMapData;
  mode: "editor" | "client";
  /** Slug projektu w portalu klienta (wymagany gdy mode=client). */
  portalSlug?: string;
  /** Aktywna ścieżka strategii (z ?path=) — null = wszystkie. */
  activePathId?: string | null;
  initialView?: View;
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
    return "map";
  }
  if (v === "pipeline") return "pipeline";
  if (v === "map") return "map";
  if (v === "influence") return "influence";
  return "list";
}

export function StrategyMap({
  projectId,
  data,
  mode,
  portalSlug,
  activePathId = null,
  initialView,
}: StrategyMapProps) {
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") ?? initialView;

  const [view, setView] = useState<View>(() =>
    resolveDefaultView(mode, viewParam, initialView)
  );
  const [presentSignal, setPresentSignal] = useState(0);

  const startPresentation = () => {
    setView("map");
    setPresentSignal((n) => n + 1);
  };

  const constellationHref =
    mode === "client" && portalSlug
      ? `/projects/${portalSlug}/strategy/constellation`
      : `/strategy-hub/projects/${projectId}/constellation`;

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
              {mode === "editor" && (
                <ToggleBtn
                  active={view === "pipeline"}
                  onClick={() => setView("pipeline")}
                  icon={<GitBranch className="size-3.5" />}
                  label="Pipeline"
                />
              )}
            </div>
            <Link
              href={constellationHref}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
            >
              <Sparkles className="size-3.5" />
              Konstelacja
            </Link>
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
