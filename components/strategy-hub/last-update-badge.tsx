"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface HistoryRow {
  id: string;
  source: string;
  field: string | null;
  createdAt: string;
  userId: string | null;
}

interface LastUpdateBadgeProps {
  projectId: string;
  entityType: string;
  entityId: string;
  className?: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "przed chwilą";
  if (mins < 60) return `${mins} min temu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} h temu`;
  return new Date(iso).toLocaleDateString("pl-PL");
}

function sourceLabel(source: string): string {
  if (source === "notion") return "Z Notion";
  if (source === "ai") return "AI";
  return "Hub";
}

export function LastUpdateBadge({
  projectId,
  entityType,
  entityId,
  className,
}: LastUpdateBadgeProps) {
  const [row, setRow] = useState<HistoryRow | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ entityType, entityId, limit: "1" });
    fetch(`/api/strategy-hub/projects/${projectId}/change-history?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: HistoryRow[] } | null) => setRow(d?.items?.[0] ?? null))
      .catch(() => setRow(null));
  }, [projectId, entityType, entityId]);

  if (!row) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums",
        className
      )}
    >
      {sourceLabel(row.source)} · {relativeTime(row.createdAt)}
    </span>
  );
}
