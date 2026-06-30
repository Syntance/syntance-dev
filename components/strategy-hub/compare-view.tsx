"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CompareViewProps {
  open: boolean;
  onClose: () => void;
  left: React.ReactNode;
  right: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
}

/** Side-by-side compare z przeciąganym separatorem (bez zewn. deps). */
export function CompareView({
  open,
  onClose,
  left,
  right,
  leftLabel = "Wersja A",
  rightLabel = "Wersja B",
}: CompareViewProps) {
  const [ratio, setRatio] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMove = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setRatio(Math.min(80, Math.max(20, pct)));
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-label="Porównanie side-by-side"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-medium">Porównaj (⌘⇧C)</span>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Zamknij">
          <X className="size-4" />
        </Button>
      </div>
      <div
        ref={containerRef}
        className="relative flex flex-1 min-h-0 overflow-hidden"
        onMouseMove={(e) => {
          if (dragging.current) onMove(e.clientX);
        }}
        onMouseUp={() => {
          dragging.current = false;
        }}
        onMouseLeave={() => {
          dragging.current = false;
        }}
      >
        <div
          className="min-h-0 overflow-y-auto border-r border-border p-4"
          style={{ width: `${ratio}%` }}
        >
          <p className="text-xs font-medium text-muted-foreground mb-2">{leftLabel}</p>
          {left}
        </div>
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={ratio}
          className="absolute top-0 bottom-0 z-10 flex w-3 -translate-x-1/2 cursor-col-resize items-center justify-center bg-border/50 hover:bg-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ left: `${ratio}%` }}
          tabIndex={0}
          onMouseDown={() => {
            dragging.current = true;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setRatio((r) => Math.max(20, r - 5));
            if (e.key === "ArrowRight") setRatio((r) => Math.min(80, r + 5));
          }}
        >
          <GripVertical className="size-3 text-muted-foreground" />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">{rightLabel}</p>
          {right}
        </div>
      </div>
    </div>
  );
}
