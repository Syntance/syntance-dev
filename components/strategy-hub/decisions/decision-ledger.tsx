"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { KONST } from "@/components/strategy-hub/constellation/constellation-theme";
import { PANEL_SLIDE } from "@/components/strategy-hub/konst-animation";
import type { LedgerDecision } from "@/lib/strategy-hub/decisions-ledger";
import type { EntityTypeKey } from "@/lib/strategy-hub/entities/entity-types";

const THREAD_AXIS_TYPES: EntityTypeKey[] = [
  "segment",
  "problem",
  "stage",
  "element",
  "flow",
  "page",
  "section",
  "kpi",
];

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export interface DecisionLedgerProps {
  open: boolean;
  decisions: LedgerDecision[];
  selectedId: string | null;
  segmentId: string | null;
  onClose: () => void;
  onSelect: (decision: LedgerDecision | null) => void;
  onShowThread?: (entityType: EntityTypeKey, entityId: string) => void;
}

export function DecisionLedger({
  open,
  decisions,
  selectedId,
  segmentId,
  onClose,
  onSelect,
  onShowThread,
}: DecisionLedgerProps) {
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<"segment" | "all">("segment");

  const filtered = useMemo(() => {
    if (filter === "all") return decisions;
    if (!segmentId) return decisions.filter((d) => d.segmentIds.length === 0);
    return decisions.filter(
      (d) =>
        d.segmentIds.length === 0 || d.segmentIds.includes(segmentId)
    );
  }, [decisions, filter, segmentId]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Zamknij dziennik decyzji"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={() => {
          onSelect(null);
          onClose();
        }}
      />
      <motion.aside
        className="fixed inset-y-0 left-0 z-50 flex w-80 flex-col border-r backdrop-blur-md"
        style={{
          backgroundColor: "rgba(28,25,19,0.96)",
          borderColor: KONST.chromeBorder,
        }}
        initial={reducedMotion ? false : { x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -24, opacity: 0 }}
        transition={
          reducedMotion ? { duration: 0 } : PANEL_SLIDE
        }
        aria-label="Dziennik decyzji"
      >
        <div
          className="flex items-center justify-between border-b px-3 py-3"
          style={{ borderColor: KONST.chromeBorder }}
        >
          <p className="text-xs font-medium" style={{ color: KONST.label }}>
            Decyzje ({filtered.length})
          </p>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              onClose();
            }}
            className="inline-flex size-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
            style={{ color: KONST.muted }}
            aria-label="Zamknij"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-3 border-b px-3 py-2 text-[11px]">
          {(["segment", "all"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60",
                filter === tab ? "font-medium" : "opacity-60"
              )}
              style={{ color: filter === tab ? KONST.label : KONST.muted }}
              onClick={() => setFilter(tab)}
            >
              {tab === "segment" ? "Segment" : "Wszystkie"}
            </button>
          ))}
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {filtered.map((d, i) => {
            const active = selectedId === d.id;
            const threadEffect = d.effects.find((e) =>
              THREAD_AXIS_TYPES.includes(e.type)
            );
            return (
              <li key={d.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60",
                    active && "ring-1"
                  )}
                  style={{
                    backgroundColor: active ? "#211D15" : "#1C1913",
                    borderColor: active ? `${KONST.spark}b3` : "#3A342A",
                  }}
                  onClick={() => onSelect(active ? null : d)}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: "#B7AE97" }}
                  >
                    #{String(i + 1).padStart(2, "0")} · {d.title}
                  </p>
                  <p className="mt-1 text-[11px]" style={{ color: KONST.muted }}>
                    {formatDate(d.createdAt)} · {d.authorType}
                  </p>
                  {d.reasonMd && (
                    <p
                      className="mt-1 line-clamp-2 text-[11px]"
                      style={{ color: KONST.muted }}
                    >
                      {d.reasonMd}
                    </p>
                  )}
                  {active && (
                    <p
                      className="mt-2 text-[10px]"
                      style={{ color: KONST.spark }}
                    >
                      zasięg: {d.causes.length + d.effects.length} elementów →
                    </p>
                  )}
                  {active && threadEffect && onShowThread && (
                    <span
                      role="link"
                      tabIndex={0}
                      className="mt-2 inline-block text-[11px] underline"
                      style={{ color: KONST.downText }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onShowThread(threadEffect.type, threadEffect.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          onShowThread(threadEffect.type, threadEffect.id);
                        }
                      }}
                    >
                      Pokaż nitkę
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </motion.aside>
    </>
  );
}

export type { LedgerDecision };
