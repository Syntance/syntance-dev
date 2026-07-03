"use client";

import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/strategy-hub/strategy-map/status-dot";
import type {
  PipelineStage,
  PipelineStageStatus,
} from "@/lib/strategy-hub/pipeline-types";
import type { NodeStatus } from "@/lib/strategy-hub/strategy-map-types";

interface PipelineStageCardProps {
  stage: PipelineStage;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
  mode: "editor" | "client";
}

const STATUS_LABELS: Record<PipelineStageStatus, string> = {
  empty: "Pusty",
  in_progress: "W trakcie",
  review: "Do przeglądu",
  ready: "Gotowy",
  locked: "Zablokowany",
};

function toNodeStatus(status: PipelineStageStatus): NodeStatus {
  if (status === "locked") return "empty";
  return status;
}

export function PipelineStageCard({
  stage,
  active,
  expanded,
  onSelect,
  mode,
}: PipelineStageCardProps) {
  const dotStatus = toNodeStatus(stage.status);

  return (
    <li className="flex shrink-0 flex-col items-stretch">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-expanded={expanded}
        className={cn(
          "group flex min-w-[7.5rem] flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
          active
            ? "border-brand/40 bg-brand/10"
            : "border-border bg-card hover:border-border/80 hover:bg-muted/30",
          stage.status === "locked" && "opacity-60"
        )}
      >
        <StatusDot status={dotStatus} mode={mode} className="size-2.5" />
        <span className="text-xs font-medium leading-tight text-foreground">
          {stage.label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {STATUS_LABELS[stage.status]} · {stage.score}%
        </span>
      </button>

      {expanded && (
        <div
          className="mt-3 w-[min(100vw-2rem,22rem)] rounded-xl border border-border bg-card p-4 shadow-sm"
          role="region"
          aria-label={`Szczegóły etapu ${stage.label}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{stage.label}</h3>
            <span className="text-xs text-muted-foreground">
              {STATUS_LABELS[stage.status]}
            </span>
          </div>

          {stage.status === "locked" && (
            <p className="mb-3 text-xs text-muted-foreground">
              Etap zablokowany — uzupełnij wcześniejszy etap pipeline.
            </p>
          )}

          {stage.aiActions.length > 0 && (
            <section className="mb-3">
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ostatnie akcje AI
              </h4>
              <ul className="space-y-1.5">
                {stage.aiActions.map((action, idx) => (
                  <li
                    key={`${action.at}-${idx}`}
                    className="rounded-md bg-muted/40 px-2 py-1.5 text-xs text-foreground/90"
                  >
                    {action.summary}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stage.humanGates.length > 0 && (
            <section>
              <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bramki do przejścia
              </h4>
              <ul className="space-y-1.5">
                {stage.humanGates.map((gate) => (
                  <li key={gate.href + gate.label}>
                    <a
                      href={gate.href}
                      className="inline-flex w-full items-center justify-center rounded-lg border border-brand/30 bg-brand/10 px-3 py-2 text-xs font-medium text-brand transition-colors hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
                    >
                      {gate.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stage.aiActions.length === 0 && stage.humanGates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Brak oczekujących akcji na tym etapie.
            </p>
          )}
        </div>
      )}
    </li>
  );
}
