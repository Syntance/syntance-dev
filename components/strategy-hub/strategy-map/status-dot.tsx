import { cn } from "@/lib/utils";
import type { NodeStatus } from "@/lib/strategy-hub/strategy-map-types";

interface StatusDotProps {
  status: NodeStatus;
  mode: "editor" | "client";
  className?: string;
}

/**
 * Kropka statusu węzła. W trybie client „empty" prezentuje się jak „in_progress"
 * — klient nigdy nie widzi czerwonych braków (spec: tylko ✅/🟡, czysto).
 */
export function StatusDot({ status, mode, className }: StatusDotProps) {
  const effective = mode === "client" && status === "empty" ? "in_progress" : status;
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        effective === "ready" && "bg-success",
        effective === "in_progress" && "bg-amber-400",
        effective === "empty" && "bg-red-400",
        className
      )}
      aria-hidden
    />
  );
}

export function statusEmoji(status: NodeStatus, mode: "editor" | "client"): string {
  const effective = mode === "client" && status === "empty" ? "in_progress" : status;
  if (effective === "ready") return "✅";
  if (effective === "in_progress") return "🟡";
  return "🔴";
}
