"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { List, Map as MapIcon, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ListView } from "./list-view";
import { MapView } from "./map-view";
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

type View = "list" | "map" | "influence";

interface StrategyMapProps {
  data: StrategyMapData;
  mode: "editor" | "client";
}

export function StrategyMap({ data, mode }: StrategyMapProps) {
  // Editor startuje na Liście, klient na Mapie (spec).
  const [view, setView] = useState<View>(mode === "client" ? "map" : "list");
  const [presentSignal, setPresentSignal] = useState(0);

  const startPresentation = () => {
    setView("map");
    setPresentSignal((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      {view !== "influence" && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-border bg-card p-0.5">
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
          </div>

          <button
            type="button"
            onClick={startPresentation}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white shadow-(--brand-glow) transition-opacity hover:opacity-90"
          >
            <Play className="size-3.5 fill-current" /> Prezentacja
          </button>
        </div>
      )}

      {view === "list" && <ListView nodes={data.nodes} mode={mode} />}

      {/* MapView pozostaje zamontowany (ukryty), by sygnał prezentacji
          działał niezależnie od przełączania widoków. */}
      <div className={cn(view === "map" ? "" : "hidden")}>
        <MapView
          nodes={data.nodes}
          edges={data.edges}
          order={data.presentationOrder}
          mode={mode}
          active={view === "map"}
          presentSignal={presentSignal}
          onOpenInfluence={() => setView("influence")}
        />
      </div>

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
      onClick={onClick}
      aria-pressed={active}
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
