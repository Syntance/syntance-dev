"use client";

import * as React from "react";
import { Bell, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectAlerts } from "@/components/strategy-hub/use-project-alerts";

interface Props {
  projectId: string;
}

/**
 * Dzwonek alertów projektu (Faza 8, M2) — KPI poniżej progu, domena, brak
 * wizyt klienta. Zasilany tym samym strumieniem SSE co `AlertsToaster`
 * (Faza 15, M4) — jedno połączenie zamiast dwóch niezależnych pollerów.
 */
export function AlertsBell({ projectId }: Props) {
  const alerts = useProjectAlerts(projectId);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Alerty projektu (${alerts.length})`}
        className={cn(
          "relative flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
          alerts.length > 0
            ? "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
            : "border-border/60 bg-card/50 text-muted-foreground hover:text-foreground"
        )}
      >
        <Bell className="size-3.5" />
        {alerts.length > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-0.5 text-[9px] font-bold text-white",
              criticalCount > 0 ? "bg-destructive" : "bg-amber-500"
            )}
          >
            {alerts.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-80 rounded-xl border border-border bg-card shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs font-semibold">Alerty projektu</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-1.5">
            {alerts.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                Brak aktywnych alertów. Wszystko wygląda dobrze 👍
              </p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs hover:bg-muted/50"
                >
                  {a.severity === "critical" ? (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-muted-foreground">{a.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
