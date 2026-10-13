"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STAGE_LABELS, type PipelineStage } from "@/lib/strategy-hub/wektoryzator/engine/pipeline";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { formatSeconds } from "./controls";

const ORDER: PipelineStage[] = ["decode", "resize", "smoothing", "quantize", "trace", "build"];

/**
 * Postęp pełnej wektoryzacji. Gdy na płótnie jest już wektor albo podgląd na żywo, pokazujemy
 * dyskretną pigułkę (nie zasłaniamy podglądu); pełna karta etapów tylko przy pierwszym wczytaniu.
 */
export function ProgressOverlay() {
  const status = useEditor((s) => s.status);
  const stage = useEditor((s) => s.stage);
  const startedAt = useEditor((s) => s.traceStartedAt);
  const hasDoc = useEditor((s) => s.doc !== null);
  const hasDraft = useEditor((s) => s.draft !== null);
  const cancel = useEditor((s) => s.cancelTrace);
  const [now, setNow] = useState(0);
  const busy = status === "loading" || status === "tracing";

  useEffect(() => {
    if (!busy) return;
    const id = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(id);
  }, [busy]);

  if (!busy) return null;
  const activeIndex = stage ? ORDER.indexOf(stage) : 0;
  const elapsed = startedAt !== null && now > startedAt ? now - startedAt : 0;

  if (hasDoc || hasDraft) {
    // Przy podglądzie na żywo etykieta płótna już mówi „liczę pełną jakość” — tu tylko anulowanie.
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-lg border border-border bg-card/95 py-1 pl-2.5 pr-1 text-[11px] shadow-sm backdrop-blur",
        )}
      >
        <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
        <span className="font-medium">{stage ? STAGE_LABELS[stage] : "Przetwarzam"}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{formatSeconds(elapsed)}</span>
        <button
          type="button"
          onClick={cancel}
          aria-label="Anuluj wektoryzację"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/60">
      <div className="w-72 rounded-xl border border-border bg-card p-4 shadow-lg" role="status" aria-live="polite">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Wektoryzuję obraz</p>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{formatSeconds(elapsed)}</span>
        </div>
        <ol className="space-y-1.5">
          {ORDER.map((name, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;
            return (
              <li
                key={name}
                className={cn(
                  "flex items-center gap-2 text-xs",
                  active ? "font-medium text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/50",
                )}
              >
                <span className="flex size-4 items-center justify-center">
                  {done ? (
                    <Check className="size-3.5 text-primary" aria-hidden />
                  ) : active ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
                  ) : (
                    <span className="size-1.5 rounded-full bg-current" aria-hidden />
                  )}
                </span>
                {STAGE_LABELS[name]}
                {active ? <span className="sr-only">— w toku</span> : null}
              </li>
            );
          })}
        </ol>
        <Button variant="outline" size="sm" className="mt-4 w-full" onClick={cancel}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
