"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { KONST } from "@/components/strategy-hub/constellation/constellation-theme";
import type { BlueprintCellItem, BlueprintRow } from "@/lib/strategy-hub/blueprint-types";

const ROW_LABELS: Record<BlueprintRow, string> = {
  tresci: "TREŚCI",
  kanaly: "KANAŁY",
  strona: "STRONA",
  kpi: "KPI",
};

const ROW_COLORS: Record<BlueprintRow, string> = {
  tresci: "#34D399",
  kanaly: "#C9955C",
  strona: "#94A3B8",
  kpi: "#F472B6",
};

interface BlueprintCellProps {
  row: BlueprintRow;
  items: BlueprintCellItem[];
  isGap: boolean;
  mode: "editor" | "client";
  gapHref?: string;
  highlighted: Set<string>;
  dimmed: boolean;
  onItemHover: (refKey: string | null) => void;
  onItemClick: (item: BlueprintCellItem) => void;
  pulseGap?: boolean;
}

export function BlueprintCell({
  row,
  items,
  isGap,
  mode,
  gapHref,
  highlighted,
  dimmed,
  onItemHover,
  onItemClick,
  pulseGap,
}: BlueprintCellProps) {
  if (isGap) {
    const inner = (
      <div
        className={cn(
          "flex h-[30px] items-center justify-center rounded-md border border-dashed text-[11px]",
          pulseGap && "animate-pulse"
        )}
        style={{
          borderColor: `${KONST.review}99`,
          color: `${KONST.review}cc`,
        }}
      >
        luka: brak {ROW_LABELS[row].toLowerCase()}
      </div>
    );
    return (
      <div className={cn("min-h-[48px] px-2 py-2", dimmed && "opacity-40")}>
        {mode === "editor" && gapHref ? (
          <Link href={gapHref} className="block transition-opacity hover:opacity-90">
            {inner}
          </Link>
        ) : (
          inner
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative px-2 py-2", dimmed && "opacity-40")}>
      {row === "tresci" && items.length > 1 && (
        <div
          className="absolute bottom-4 left-[18px] top-4 w-px"
          style={{ backgroundColor: "#E7DFC6", opacity: 0.22 }}
          aria-hidden
        />
      )}
      <ul className="relative space-y-[26px]">
        {items.map((item) => {
          const key = `${item.ref.type}:${item.ref.id}`;
          const hi = highlighted.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                className="group flex w-full items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
                onMouseEnter={() => onItemHover(key)}
                onMouseLeave={() => onItemHover(null)}
                onFocus={() => onItemHover(key)}
                onBlur={() => onItemHover(null)}
                onClick={() => onItemClick(item)}
              >
                <span
                  className="mt-0.5 size-[9px] shrink-0 rounded-full"
                  style={{
                    backgroundColor: "#EFE7CE",
                    boxShadow: item.status === "review" ? `0 0 0 1px ${KONST.review}` : undefined,
                  }}
                  aria-hidden
                />
                <span
                  className="text-[11px] transition-colors group-hover:text-[#CFC7AC]"
                  style={{ color: hi ? KONST.display : "#B7AE97" }}
                >
                  {item.label}
                  {item.viaLabel && (
                    <span
                      className="ml-1 italic opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: KONST.muted }}
                    >
                      · {item.viaLabel}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { ROW_LABELS, ROW_COLORS };
