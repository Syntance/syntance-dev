"use client";

import { Code2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkType } from "@/lib/strategy-hub/time-tracking-types";

const OPTIONS: {
  value: WorkType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "development", label: "Development", icon: Code2 },
  { value: "maintenance", label: "Utrzymanie", icon: Wrench },
];

interface WorkTypeSelectorProps {
  value: WorkType;
  onChange: (value: WorkType) => void;
  label?: string;
  disabled?: boolean;
}

export function WorkTypeSelector({
  value,
  onChange,
  label = "Typ pracy",
  disabled,
}: WorkTypeSelectorProps) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all",
                selected
                  ? option.value === "development"
                    ? "border-brand/40 bg-brand/10 text-brand"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-border bg-card/40 text-muted-foreground hover:border-border/80 hover:bg-card/70 hover:text-foreground",
                disabled && "pointer-events-none opacity-50"
              )}
            >
              <option.icon className="size-4 shrink-0" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WorkTypeBadge({ workType }: { workType: WorkType }) {
  const isDev = workType === "development";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        isDev
          ? "bg-brand/15 text-brand border border-brand/25"
          : "bg-amber-500/15 text-amber-200 border border-amber-500/25"
      )}
    >
      {isDev ? <Code2 className="size-3" /> : <Wrench className="size-3" />}
      {isDev ? "Dev" : "Utrzym."}
    </span>
  );
}
