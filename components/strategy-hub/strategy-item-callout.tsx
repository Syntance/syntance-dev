import { cn } from "@/lib/utils";
import {
  type StrategyListItem,
  WEIGHT_LABELS,
  type StrategyListWeight,
} from "@/lib/strategy-hub/business-strategy-lists";

function weightDotClass(w: StrategyListWeight) {
  return {
    1: "bg-emerald-500",
    2: "bg-amber-500",
    3: "bg-destructive",
  }[w];
}

interface StrategyItemCalloutProps {
  item: StrategyListItem;
  index: number;
  className?: string;
  showNote?: boolean;
}

export function StrategyItemCallout({
  item,
  index,
  className,
  showNote = false,
}: StrategyItemCalloutProps) {
  return (
    <li
      className={cn(
        "flex items-start gap-2.5 py-2.5 border-b border-border/40 last:border-b-0",
        className
      )}
    >
      <span
        className={cn(
          "mt-[0.35rem] size-2.5 rounded-full shrink-0",
          weightDotClass(item.weight)
        )}
        title={WEIGHT_LABELS[item.weight]}
        aria-label={WEIGHT_LABELS[item.weight]}
      />
      <span className="text-[11px] text-muted-foreground tabular-nums pt-0.5 shrink-0 w-4 text-right select-none">
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground/90">{item.text}</p>
        {showNote && item.note.trim() ? (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {item.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}
