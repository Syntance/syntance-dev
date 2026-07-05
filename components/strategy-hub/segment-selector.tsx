"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { KONST } from "@/components/strategy-hub/constellation/constellation-theme";

export interface SegmentSelectorProps {
  segments: { id: string; name: string; icon?: string | null }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

export function SegmentSelector({
  segments,
  selectedId,
  onSelect,
  className,
}: SegmentSelectorProps) {
  const listboxId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  const selected =
    segments.find((s) => s.id === selectedId) ?? segments[0] ?? null;

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (
        buttonRef.current?.contains(t) ||
        listRef.current?.contains(t)
      ) {
        return;
      }
      close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  const pick = useCallback(
    (id: string) => {
      onSelect(id);
      close();
    },
    [onSelect, close]
  );

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        const idx = segments.findIndex((s) => s.id === selectedId);
        setActiveIndex(idx >= 0 ? idx : 0);
      }
      setOpen((v) => !v);
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(segments.length - 1, i + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const seg = segments[activeIndex];
      if (seg) pick(seg.id);
    }
  };

  if (segments.length === 0) return null;

  return (
    <div className={cn("relative inline-flex", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
        style={{
          backgroundColor: KONST.chromeBg,
          borderColor: KONST.chromeBorder,
          borderWidth: 0.5,
        }}
        onClick={() => {
          const idx = segments.findIndex((s) => s.id === selectedId);
          setActiveIndex(idx >= 0 ? idx : 0);
          setOpen((v) => !v);
        }}
        onKeyDown={onButtonKeyDown}
      >
        <span
          className="text-[11px] uppercase tracking-[0.08em]"
          style={{ color: KONST.muted }}
        >
          Segment:
        </span>
        <span
          className="max-w-[140px] truncate text-xs font-medium transition-colors group-hover:text-[#E9E1C6]"
          style={{ color: KONST.label }}
        >
          {selected?.icon ? `${selected.icon} ` : ""}
          {selected?.name ?? "—"}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0"
          style={{ color: KONST.muted }}
          aria-hidden
        />
      </button>

      {open && (
        <motion.ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-activedescendant={`${listboxId}-opt-${activeIndex}`}
          tabIndex={-1}
          className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-[280px] min-w-[200px] overflow-y-auto rounded-xl border shadow-2xl outline-none"
          style={{
            backgroundColor: "#1C1913",
            borderColor: KONST.chromeBorder,
          }}
          initial={
            reducedMotion ? false : { opacity: 0, y: -4 }
          }
          animate={{ opacity: 1, y: 0 }}
          transition={
            reducedMotion ? { duration: 0 } : { duration: 0.14, ease: "easeOut" }
          }
          onKeyDown={onListKeyDown}
        >
          {segments.map((seg, i) => {
            const active = seg.id === selectedId;
            const focused = i === activeIndex;
            return (
              <li
                key={seg.id}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={active}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors"
                style={{
                  color: KONST.label,
                  backgroundColor: focused ? "#2A251B" : undefined,
                }}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => pick(seg.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    pick(seg.id);
                  }
                }}
              >
                {active && (
                  <span
                    className="size-1 shrink-0 rounded-full"
                    style={{ backgroundColor: "#EFE7CE" }}
                    aria-hidden
                  />
                )}
                {!active && <span className="size-1 shrink-0" aria-hidden />}
                <span className="truncate">
                  {seg.icon ? `${seg.icon} ` : ""}
                  {seg.name}
                </span>
              </li>
            );
          })}
        </motion.ul>
      )}
    </div>
  );
}
