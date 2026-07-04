"use client";

import { X } from "lucide-react";
import { HealthRing } from "@/components/strategy-hub/health-ring";
import type { CoreSingletons } from "@/lib/strategy-hub/constellation-types";

interface CorePanelProps {
  projectLabel: string;
  health: number;
  singletons: CoreSingletons;
  open: boolean;
  onClose: () => void;
}

function clipMd(text: string | null, max = 480): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

export function CorePanel({
  projectLabel,
  health,
  singletons,
  open,
  onClose,
}: CorePanelProps) {
  if (!open) return null;

  const uvp = clipMd(singletons.uvpMd);
  const positioning = clipMd(singletons.positioningMd);

  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-border bg-card/95 shadow-xl backdrop-blur-sm"
      aria-label={`Rdzeń strategii: ${projectLabel}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Rdzeń strategii</p>
          <h2 className="text-sm font-semibold truncate">{projectLabel}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij panel rdzenia"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            Kondycja strategii
          </h3>
          <div className="flex items-center gap-4">
            <HealthRing score={health} />
            <div>
              <p className="text-2xl font-semibold tabular-nums">{health}%</p>
              <p className="text-xs text-muted-foreground">
                Agregat modułów strategii
              </p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            UVP
          </h3>
          {uvp ? (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{uvp}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Brak głównego UVP.</p>
          )}
        </section>

        <section>
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
            Pozycjonowanie
          </h3>
          {positioning ? (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">
              {positioning}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Brak stwierdzenia pozycjonowania.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
