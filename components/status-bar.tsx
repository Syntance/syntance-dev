"use client";

import { Check } from "lucide-react";
import { clsx } from "clsx";

const STATUSES = [
  { key: "design", label: "Projektowanie" },
  { key: "development", label: "Development" },
  { key: "qa", label: "Testowanie" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
] as const;

export function StatusBar({ currentStatus }: { currentStatus: string }) {
  const currentIndex = STATUSES.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STATUSES.map((status, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={status.key} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCompleted &&
                      "border-accent-light bg-accent-light text-white",
                    isCurrent &&
                      "border-accent-light bg-accent/20 text-accent-light ring-4 ring-accent/20",
                    isPending && "border-border bg-card text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <span
                  className={clsx(
                    "text-xs font-medium whitespace-nowrap",
                    isCurrent && "text-accent-light",
                    isCompleted && "text-muted-foreground",
                    isPending && "text-muted-foreground/50"
                  )}
                >
                  {status.label}
                </span>
              </div>

              {index < STATUSES.length - 1 && (
                <div className="mx-2 mt-[-1.5rem] h-0.5 flex-1">
                  <div
                    className={clsx(
                      "h-full rounded-full transition-all duration-300",
                      index < currentIndex ? "bg-accent-light" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
