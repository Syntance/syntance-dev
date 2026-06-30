"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HistoryRow {
  id: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  source: string;
  createdAt: string;
}

interface VersionTimelineProps {
  projectId: string;
  entityType: string;
  entityId: string;
  className?: string;
  readOnly?: boolean;
}

export function VersionTimeline({
  projectId,
  entityType,
  entityId,
  className,
  readOnly = false,
}: VersionTimelineProps) {
  const [items, setItems] = useState<HistoryRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const params = new URLSearchParams({ entityType, entityId, limit: "20" });
    fetch(`/api/strategy-hub/projects/${projectId}/change-history?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: HistoryRow[] } | null) => setItems(d?.items ?? []))
      .catch(() => setItems([]));
  }, [open, projectId, entityType, entityId]);

  return (
    <div className={cn("space-y-2", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 text-xs text-muted-foreground"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <History className="size-3.5" />
        Historia zmian
      </Button>
      {open && (
        <ol className="space-y-2 border-l-2 border-border pl-3 max-h-64 overflow-y-auto">
          {items.length === 0 ? (
            <li className="text-xs text-muted-foreground">Brak wpisów.</li>
          ) : (
            items.map((h) => (
              <li key={h.id} className="text-xs space-y-1">
                <div className="text-muted-foreground">
                  {new Date(h.createdAt).toLocaleString("pl-PL")} · {h.source}
                  {h.field ? ` · ${h.field}` : ""}
                </div>
                {h.oldValue && (
                  <div className="line-through opacity-50 truncate">{h.oldValue}</div>
                )}
                {h.newValue && <div className="truncate">{h.newValue}</div>}
                {!readOnly && h.oldValue && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                    aria-label="Przywróć poprzednią wartość"
                  >
                    <RotateCcw className="size-3" /> Przywróć
                  </button>
                )}
              </li>
            ))
          )}
        </ol>
      )}
    </div>
  );
}
