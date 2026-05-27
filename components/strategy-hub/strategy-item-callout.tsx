import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  type StrategyListItem,
  WEIGHT_LABELS,
  weightBgClass,
  weightBadgeClass,
  weightBorderClass,
} from "@/lib/strategy-hub/business-strategy-lists";

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
    <div
      className={cn(
        "w-fit min-w-[min(100%,16rem)] max-w-lg rounded-lg border border-border border-l-[3px] px-3 py-2.5",
        weightBorderClass(item.weight),
        weightBgClass(item.weight),
        className
      )}
    >
      <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 items-start">
        <span
          className="text-xs font-medium text-muted-foreground pt-0.5 tabular-nums text-right"
          aria-hidden
        >
          {index + 1}.
        </span>
        <p className="min-w-0 text-sm font-medium leading-snug text-foreground/95">
          {item.text}
        </p>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[10px] h-5 px-2 font-medium border",
            weightBadgeClass(item.weight)
          )}
        >
          {WEIGHT_LABELS[item.weight]}
        </Badge>
        {showNote && item.note.trim() ? (
          <p className="col-start-2 min-w-0 text-xs text-muted-foreground leading-relaxed">
            {item.note}
          </p>
        ) : null}
      </div>
    </div>
  );
}
