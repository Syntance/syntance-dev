"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { PipelineStageCard } from "./pipeline-stage";
import type { PipelineData, PipelineStage } from "@/lib/strategy-hub/pipeline-types";
import { cn } from "@/lib/utils";

interface PipelineViewProps {
  projectId: string;
  mode: "editor" | "client";
}

function pickDefaultActive(stages: PipelineStage[]): number {
  const inProgress = stages.findIndex(
    (s) => s.status === "in_progress" || s.status === "review"
  );
  if (inProgress >= 0) return inProgress;
  const firstUnlocked = stages.findIndex((s) => s.status !== "locked");
  return firstUnlocked >= 0 ? firstUnlocked : 0;
}

export function PipelineView({ projectId, mode }: PipelineViewProps) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    void fetch(`/api/strategy-hub/projects/${projectId}/pipeline`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Nie udało się załadować pipeline");
        return res.json() as Promise<PipelineData>;
      })
      .then((json) => {
        setData(json);
        setActiveIdx(pickDefaultActive(json.stages));
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Błąd ładowania");
      });
  }, [projectId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-[320px] items-center justify-center gap-2 rounded-2xl border border-border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie pipeline…
      </div>
    );
  }

  const stages = data.stages;

  return (
    <div
      className="space-y-6 rounded-2xl border border-border bg-card/30 p-4 md:p-6"
      data-testid="pipeline-view"
    >
      <div>
        <h2 className="text-sm font-semibold">Pipeline strategii</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Etapy od briefu po KPI — status, akcje AI i bramki wymagające uwagi.
        </p>
      </div>

      <div className="relative overflow-x-auto pb-2">
        <div
          className="absolute left-8 right-8 top-[2.1rem] hidden h-px bg-border md:block"
          aria-hidden
        />
        <ol
          className={cn(
            "relative flex min-w-max gap-3 md:gap-4",
            "motion-safe:scroll-smooth"
          )}
          aria-label="Etapy pipeline strategii"
        >
          {stages.map((stage, idx) => (
            <PipelineStageCard
              key={stage.key}
              stage={stage}
              active={activeIdx === idx}
              expanded={activeIdx === idx}
              onSelect={() => setActiveIdx(idx)}
              mode={mode}
            />
          ))}
        </ol>
      </div>

      <p className="sr-only" aria-live="polite">
        Aktywny etap: {stages[activeIdx]?.label}, status{" "}
        {stages[activeIdx]?.status}
      </p>
    </div>
  );
}
