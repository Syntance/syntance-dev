"use client";

import { useState } from "react";
import { ChevronDown, Globe, BookOpen, Database, Edit3, Plus, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hasMapFocusListener,
  mapFocusHref,
} from "@/lib/strategy-hub/map-focus-bus";
import { parseFocusArgs } from "./use-map-focus-from-chat";

const TOOL_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  read_project: {
    label: "Czyta dane projektu",
    icon: Database,
    color: "text-sky-400",
  },
  update_business_strategy: {
    label: "Aktualizuje strategię",
    icon: Edit3,
    color: "text-amber-400",
  },
  upsert_segment: {
    label: "Zapisuje segment",
    icon: Plus,
    color: "text-emerald-400",
  },
  upsert_kpi: {
    label: "Zapisuje KPI",
    icon: Plus,
    color: "text-emerald-400",
  },
  web_search: {
    label: "Przeszukuje internet",
    icon: Globe,
    color: "text-violet-400",
  },
  read_notion: {
    label: "Czyta Notion",
    icon: BookOpen,
    color: "text-orange-400",
  },
  focus_map_node: {
    label: "Pokazuje na mapie",
    icon: MapPin,
    color: "text-brand",
  },
  get_neighbors: {
    label: "Sąsiedzi w grafie",
    icon: Database,
    color: "text-sky-400",
  },
  find_path: {
    label: "Ścieżka w grafie",
    icon: Database,
    color: "text-sky-400",
  },
  semantic_search: {
    label: "Wyszukiwanie semantyczne",
    icon: Database,
    color: "text-sky-400",
  },
};

interface ToolCallCardProps {
  toolName: string;
  args?: Record<string, unknown>;
  result?: unknown;
  state: "call" | "result" | "partial-call";
  projectId?: string;
}

export function ToolCallCard({ toolName, args, result, state, projectId }: ToolCallCardProps) {
  const [open, setOpen] = useState(false);
  const meta = TOOL_META[toolName] ?? { label: toolName, icon: Database, color: "text-muted-foreground" };
  const Icon = meta.icon;

  const isLoading = state === "call" || state === "partial-call";
  const hasResult = state === "result" && result != null;

  const focusDetail =
    toolName === "focus_map_node" ? parseFocusArgs(args) : null;
  const showMapLink =
    focusDetail &&
    projectId &&
    !hasMapFocusListener() &&
    state === "result";

  return (
    <div className="my-1.5 rounded-lg border border-border/60 bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        <div className={cn("flex items-center gap-1.5 flex-1 min-w-0", meta.color)}>
          {isLoading ? (
            <span className="size-3 rounded-full border border-current border-t-transparent animate-spin shrink-0" />
          ) : (
            <Icon className="size-3.5 shrink-0" />
          )}
          <span className="text-xs font-medium truncate">{meta.label}</span>
        </div>
        {(args ?? hasResult) && (
          <ChevronDown
            className={cn(
              "size-3 text-muted-foreground shrink-0 transition-transform",
              open && "rotate-180"
            )}
          />
        )}
      </button>

      {open && (
        <div className="border-t border-border/40 px-3 py-2 space-y-2">
          {args && Object.keys(args).length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Parametry
              </p>
              <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap break-all">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Wynik
              </p>
              <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
          {showMapLink && focusDetail && (
            <a
              href={mapFocusHref(
                projectId,
                focusDetail.entityType,
                focusDetail.entityId
              )}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded"
            >
              <MapPin className="size-3" />
              Pokaż na mapie
            </a>
          )}
        </div>
      )}
    </div>
  );
}
