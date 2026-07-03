"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StrategyArea } from "@/lib/strategy-hub/entities/entity-types";
import { areaNodeId } from "@/lib/strategy-hub/constellation-types";

interface AreaNavigatorProps {
  areasOrder: StrategyArea[];
  focusedId: string | null;
  onSelectArea: (areaId: string) => void;
  className?: string;
}

export function AreaNavigator({
  areasOrder,
  focusedId,
  onSelectArea,
  className,
}: AreaNavigatorProps) {
  const areaIds = areasOrder.map((a) => areaNodeId(a));
  const currentIdx = focusedId ? areaIds.indexOf(focusedId) : -1;

  const go = (delta: number) => {
    if (areaIds.length === 0) return;
    const next =
      currentIdx < 0
        ? 0
        : (currentIdx + delta + areaIds.length) % areaIds.length;
    onSelectArea(areaIds[next] ?? areaIds[0] ?? "");
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border border-border/80 bg-card/90 px-2 py-1 shadow-lg backdrop-blur",
        className
      )}
    >
      <button
        type="button"
        onClick={() => go(-1)}
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Poprzedni obszar"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[7rem] text-center text-xs text-muted-foreground">
        {currentIdx >= 0 ? `${currentIdx + 1} / ${areaIds.length}` : "Obszary"}
      </span>
      <button
        type="button"
        onClick={() => go(1)}
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Następny obszar"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
