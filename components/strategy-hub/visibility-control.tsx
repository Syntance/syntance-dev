"use client";

import * as React from "react";
import { Eye, EyeOff, Hammer, Check, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export type VisibilityStatus = "visible" | "hidden" | "in_progress";
export type VisibilityScope = "module" | "record";

interface Option {
  value: VisibilityStatus;
  label: string;
  desc: string;
  icon: typeof Eye;
  className: string;
}

const OPTIONS: Option[] = [
  {
    value: "visible",
    label: "Widoczny",
    desc: "Klient widzi ten element",
    icon: Eye,
    className: "text-emerald-400",
  },
  {
    value: "in_progress",
    label: "W budowie",
    desc: "Klient widzi etykietę „w budowie”",
    icon: Hammer,
    className: "text-amber-400",
  },
  {
    value: "hidden",
    label: "Ukryty",
    desc: "Klient nie widzi tego elementu",
    icon: EyeOff,
    className: "text-muted-foreground",
  },
];

interface VisibilityControlProps {
  projectId: string;
  scope: VisibilityScope;
  entityType: string;
  entityId?: string | null;
  initialStatus?: VisibilityStatus;
  /** "icon" — sam przycisk ikony (karty); "chip" — ikona + etykieta. */
  variant?: "icon" | "chip";
  onChange?: (status: VisibilityStatus) => void;
  className?: string;
}

export function VisibilityControl({
  projectId,
  scope,
  entityType,
  entityId,
  initialStatus = "visible",
  variant = "icon",
  onChange,
  className,
}: VisibilityControlProps) {
  const [status, setStatus] = React.useState<VisibilityStatus>(initialStatus);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const current = OPTIONS.find((o) => o.value === status) ?? OPTIONS[0];
  const Icon = current.icon;

  const apply = async (next: VisibilityStatus) => {
    const prev = status;
    setStatus(next);
    setOpen(false);
    setPending(true);
    onChange?.(next);
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/visibility`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, entityType, entityId, status: next }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) throw new Error("save failed");
    } catch {
      setStatus(prev);
      onChange?.(prev);
    } finally {
      setPending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Widoczność dla klienta: ${current.label}`}
          title={`Widoczność dla klienta: ${current.label}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            variant === "icon"
              ? "size-6 justify-center hover:bg-muted"
              : "h-7 px-2 border border-border/60 bg-card/50 hover:border-border text-xs",
            className
          )}
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Icon className={cn("size-3.5", current.className)} />
          )}
          {variant === "chip" && (
            <>
              <span className={current.className}>{current.label}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <div className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Widoczność dla klienta
        </div>
        {OPTIONS.map((o) => {
          const OIcon = o.icon;
          const active = o.value === status;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => apply(o.value)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                active && "bg-accent/60"
              )}
            >
              <OIcon className={cn("size-4 mt-0.5 shrink-0", o.className)} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-tight">
                  {o.label}
                </span>
                <span className="block text-xs text-muted-foreground leading-tight">
                  {o.desc}
                </span>
              </span>
              {active && <Check className="size-4 shrink-0 text-brand mt-0.5" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
