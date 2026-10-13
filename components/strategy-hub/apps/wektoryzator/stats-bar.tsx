"use client";

import { useMemo } from "react";
import { visiblePaths } from "@/lib/strategy-hub/wektoryzator/engine/document";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { formatNumber, formatSeconds } from "./controls";

export function StatsBar() {
  const doc = useEditor((s) => s.doc);
  const stats = useEditor((s) => s.stats);
  const selection = useEditor((s) => s.selection);
  const error = useEditor((s) => s.error);

  const summary = useMemo(() => {
    if (!doc) return null;
    const paths = visiblePaths(doc);
    let segments = 0;
    const colors = new Set<number>();
    for (const p of paths) {
      segments += p.segments;
      colors.add(p.swatch);
    }
    return { paths: paths.length, segments, colors: colors.size, layers: doc.layers.filter((l) => l.visible).length };
  }, [doc]);

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
      {error ? (
        <p role="alert" className="font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {summary && stats ? (
        <>
          <span>
            <strong className="font-semibold text-foreground">{formatNumber(summary.paths)}</strong> kształtów
          </span>
          <span>
            <strong className="font-semibold text-foreground">{formatNumber(summary.segments)}</strong> segmentów
          </span>
          <span>
            <strong className="font-semibold text-foreground">{formatNumber(summary.colors)}</strong> kolorów
          </span>
          <span>
            <strong className="font-semibold text-foreground">{formatNumber(summary.layers)}</strong> warstw
          </span>
          <span>
            obraz roboczy {formatNumber(stats.workingWidth)}×{formatNumber(stats.workingHeight)} px
          </span>
          <span>czas {formatSeconds(stats.timings.total)}</span>
          {selection.length > 0 ? (
            <span className="text-primary">zaznaczono {formatNumber(selection.length)}</span>
          ) : null}
        </>
      ) : !error ? (
        <span>
          Kółko — zoom · Spacja + przeciąganie — przesuwanie · Klik — zaznacz · Alt+klik — ten sam kolor · Dwuklik —
          obiekt
        </span>
      ) : null}
    </div>
  );
}
