"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, X, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectIdFromPath } from "@/components/strategy-hub/project-context";
import {
  useProjectAlerts,
  type ProjectAlert,
} from "@/components/strategy-hub/use-project-alerts";

const AUTO_DISMISS_MS = 12_000;

/**
 * Lekki toaster alertów strategii — subskrybuje SSE (`useProjectAlerts`,
 * <5s realtime, Faza 15) i pokazuje NOWE alerty (niewidziane wcześniej)
 * jako znikające powiadomienia. Bez zewnętrznej zależności (sonner) —
 * własna kolejka + motion.
 */
export function AlertsToaster() {
  const projectId = useProjectIdFromPath();
  const incoming = useProjectAlerts(projectId);
  const [active, setActive] = React.useState<ProjectAlert[]>([]);
  const seenRef = React.useRef<Set<string>>(new Set());
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismiss = React.useCallback((id: string) => {
    setActive((prev) => prev.filter((a) => a.id !== id));
    const t = timersRef.current.get(id);
    if (t) {
      clearTimeout(t);
      timersRef.current.delete(id);
    }
  }, []);

  React.useEffect(() => {
    const fresh = incoming.filter((a) => !seenRef.current.has(a.id));
    if (fresh.length === 0) return;
    fresh.forEach((a) => seenRef.current.add(a.id));
    setActive((prev) => [...prev, ...fresh].slice(-4));
    fresh.forEach((a) => {
      const t = setTimeout(() => dismiss(a.id), AUTO_DISMISS_MS);
      timersRef.current.set(a.id, t);
    });
  }, [incoming, dismiss]);

  // Reset widocznych toastów przy zmianie projektu — liczony podczas renderu
  // (wzorzec „poprzedni prop"), bez set-state-in-effect.
  const [prevProjectId, setPrevProjectId] = React.useState(projectId);
  if (projectId !== prevProjectId) {
    setPrevProjectId(projectId);
    setActive([]);
  }

  // Sprzątanie timerów i pamięci „widzianych" przy zmianie projektu / odmontowaniu.
  React.useEffect(() => {
    const timers = timersRef.current;
    const seen = seenRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      seen.clear();
    };
  }, [projectId]);

  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {active.map((a) => {
          const critical = a.severity === "critical";
          const Icon = critical ? TriangleAlert : AlertTriangle;
          return (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur",
                critical
                  ? "border-destructive/40"
                  : "border-amber-500/30"
              )}
              role="alert"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  critical ? "text-destructive" : "text-amber-400"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(a.id)}
                className="rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
                aria-label="Zamknij powiadomienie"
              >
                <X className="size-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
