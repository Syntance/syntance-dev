"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscribeToasts, type AppToast } from "@/lib/strategy-hub/toast";

const AUTO_DISMISS_MS = 6_000;

/**
 * Toaster błędów technicznych (zapis/ładowanie z `apiFetch`) — ten sam język
 * wizualny co `AlertsToaster`, osobny narożnik (lewy dół), żeby nie mieszać
 * się z alertami strategii.
 */
export function AppToaster() {
  const [active, setActive] = React.useState<AppToast[]>([]);
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const dismiss = React.useCallback((id: string) => {
    setActive((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  React.useEffect(() => {
    const unsubscribe = subscribeToasts((toast) => {
      setActive((prev) => [...prev, toast].slice(-3));
      timersRef.current.set(
        toast.id,
        setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS)
      );
    });
    const timers = timersRef.current;
    return () => {
      unsubscribe();
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [dismiss]);

  if (active.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      <AnimatePresence initial={false}>
        {active.map((t) => {
          const error = t.severity === "error";
          const Icon = error ? CircleAlert : Info;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: -24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -24, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur",
                error ? "border-destructive/40" : "border-border"
              )}
              role="alert"
            >
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  error ? "text-destructive" : "text-muted-foreground"
                )}
              />
              <p className="min-w-0 flex-1 text-sm leading-tight">{t.message}</p>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
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
