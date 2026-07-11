"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { KONST } from "@/components/strategy-hub/constellation/constellation-theme";
import { SegmentSelector } from "@/components/strategy-hub/segment-selector";
import { STAGGER_COLUMN } from "@/components/strategy-hub/konst-animation";
import type {
  BlueprintCellItem,
  BlueprintData,
  BlueprintRow,
} from "@/lib/strategy-hub/blueprint-types";
import { blueprintGapHref } from "@/lib/strategy-hub/blueprint-types";
import { BlueprintCell, ROW_COLORS, ROW_LABELS } from "./blueprint-cell";

const DISPLAY_FONT =
  "var(--font-konst, Georgia, 'Times New Roman', serif)";

const ROWS: BlueprintRow[] = ["tresci", "kanaly", "sprzedaz", "strona", "kpi"];

interface BlueprintViewProps {
  projectId: string;
  mode: "editor" | "client";
  initialData: BlueprintData;
  constellationBase: string;
  onDecisionsClick?: () => void;
  decisionCount?: number;
  dimRefKeys?: Set<string> | null;
}

export function BlueprintView({
  projectId,
  mode,
  initialData,
  constellationBase,
  onDecisionsClick,
  decisionCount = 0,
  dimRefKeys = null,
}: BlueprintViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reducedMotion = useReducedMotion();
  const [data, setData] = useState(initialData);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pulseGaps, setPulseGaps] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const firstGapRef = useRef<HTMLDivElement | null>(null);

  const segmentParam = searchParams.get("segment");

  const [prevInitial, setPrevInitial] = useState(initialData);
  if (initialData !== prevInitial) {
    setPrevInitial(initialData);
    setData(initialData);
  }

  useEffect(() => {
    const q = new URLSearchParams({ mode });
    if (segmentParam) q.set("segment", segmentParam);
    void fetch(`/api/strategy-hub/projects/${projectId}/blueprint?${q}`, {
      signal: AbortSignal.timeout(15_000),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Blueprint fetch failed");
        return r.json() as Promise<BlueprintData>;
      })
      .then(setData)
      .catch(() => undefined);
  }, [projectId, mode, segmentParam]);

  useEffect(() => {
    if (reducedMotion) return;
    const t = window.setTimeout(() => setPulseGaps(true), 400);
    const t2 = window.setTimeout(() => setPulseGaps(false), 1300);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [data.selected?.id, reducedMotion]);

  const relatedKeys = useMemo(() => {
    if (!hoverKey) return new Set<string>();
    return new Set([hoverKey]);
  }, [hoverKey]);

  const elementCount = useMemo(
    () =>
      data.columns.reduce(
        (s, c) => s + c.cells.tresci.filter((i) => !i.label.startsWith("+")).length,
        0
      ),
    [data.columns]
  );

  const onSegmentSelect = useCallback(
    (id: string) => {
      const sp = new URLSearchParams(searchParams.toString());
      sp.set("segment", id);
      router.replace(`?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const scrollToFirstGap = useCallback(() => {
    firstGapRef.current?.scrollIntoView({ behavior: "smooth", inline: "center" });
  }, []);

  const onItemClick = useCallback(
    (item: BlueprintCellItem) => {
      const href = `${constellationBase}?level=entity&type=${item.ref.type}&id=${item.ref.id}`;
      router.push(href);
    },
    [constellationBase, router]
  );

  const contextLine = [data.selected?.personaName, data.selected?.problemSummary]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="dark relative flex min-h-0 flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: KONST.bg }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: KONST.bgVignette }}
        aria-hidden
      />

      <header
        className="sticky top-0 z-20 flex h-24 shrink-0 items-center gap-4 border-b px-4 backdrop-blur-sm"
        style={{
          borderColor: `${KONST.chromeBorder}80`,
          backgroundColor: "rgba(22,19,14,0.85)",
        }}
      >
        <SegmentSelector
          segments={data.segments}
          selectedId={data.selected?.id ?? segmentParam}
          onSelect={onSegmentSelect}
        />
        {contextLine && (
          <p
            className="min-w-0 flex-1 truncate text-[11px] tracking-[0.08em]"
            style={{ color: KONST.muted }}
          >
            {contextLine}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {mode === "editor" && onDecisionsClick && (
            <button
              type="button"
              onClick={onDecisionsClick}
              className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors hover:text-[#E9E1C6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
              style={{
                backgroundColor: KONST.chromeBg,
                borderColor: KONST.chromeBorder,
                color: KONST.label,
              }}
            >
              Decyzje ({decisionCount})
            </button>
          )}
          <button
            type="button"
            onClick={scrollToFirstGap}
            className="rounded-full px-3 py-1 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EFE7CE]/60"
            style={{
              backgroundColor: "#211D15",
              color: KONST.review,
            }}
          >
            ⚠ {data.gapCount} luk
          </button>
        </div>
      </header>

      <div
        ref={gridRef}
        className="min-h-0 flex-1 overflow-x-auto overflow-y-auto scroll-smooth lg:overflow-x-auto"
        style={{ scrollSnapType: "x mandatory" }}
      >
        <div className="flex min-h-full min-w-min">
          <div
            className="sticky left-0 z-10 flex w-24 shrink-0 flex-col border-r pt-16"
            style={{ borderColor: "rgba(231,223,198,0.1)", backgroundColor: KONST.bg }}
          >
            {ROWS.map((row) => (
              <div
                key={row}
                className="flex min-h-[120px] items-center justify-center px-2 py-8"
              >
                <span
                  className="text-[11px] tracking-[0.2em]"
                  style={{ color: ROW_COLORS[row], opacity: 0.85 }}
                >
                  {ROW_LABELS[row]}
                </span>
              </div>
            ))}
          </div>

          {data.columns.map((col, ci) => {
            const colDimmed =
              dimRefKeys &&
              !ROWS.some((row) =>
                col.cells[row].some((item) =>
                  dimRefKeys.has(`${item.ref.type}:${item.ref.id}`)
                )
              );
            return (
              <motion.div
                key={col.stage.id}
                className={cn(
                  "flex min-w-[220px] max-w-[280px] flex-1 flex-col border-r scroll-ml-0",
                  colDimmed && "opacity-25"
                )}
                style={{
                  borderColor: "rgba(231,223,198,0.1)",
                  scrollSnapAlign: "start",
                }}
                initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : {
                        delay: STAGGER_COLUMN * ci,
                        duration: 0.3,
                        ease: "easeOut",
                      }
                }
              >
                <div
                  className="border-b px-3 py-4 text-center"
                  style={{ borderColor: "rgba(231,223,198,0.1)" }}
                  title={[col.stage.trigger, col.stage.questions]
                    .filter(Boolean)
                    .join("\n\n")}
                >
                  <p
                    className="text-[13px] uppercase tracking-[0.22em]"
                    style={{ color: KONST.label }}
                  >
                    {col.stage.name}
                  </p>
                  {col.stage.phase && (
                    <p className="mt-1 text-[11px]" style={{ color: KONST.muted }}>
                      {col.stage.phase}
                    </p>
                  )}
                </div>

                {ROWS.map((row) => {
                  const isGap = col.gaps.includes(row);
                  const isFirstGap =
                    isGap &&
                    data.columns.findIndex((c) => c.gaps.includes(row)) === ci &&
                    col.gaps[0] === row;
                  return (
                    <div
                      key={row}
                      ref={isFirstGap ? firstGapRef : undefined}
                    >
                      <BlueprintCell
                        row={row}
                        items={col.cells[row]}
                        isGap={isGap}
                        mode={mode}
                        gapHref={
                          mode === "editor"
                            ? blueprintGapHref(projectId, row)
                            : undefined
                        }
                        highlighted={relatedKeys}
                        dimmed={Boolean(
                          hoverKey &&
                            !col.cells[row].some((i) =>
                              relatedKeys.has(`${i.ref.type}:${i.ref.id}`)
                            )
                        )}
                        onItemHover={setHoverKey}
                        onItemClick={onItemClick}
                        pulseGap={pulseGaps && isGap}
                      />
                    </div>
                  );
                })}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="lg:hidden">
        <div className="flex justify-center gap-1.5 py-2">
          {data.columns.map((_, i) => (
            <span
              key={i}
              className="size-1.5 rounded-full bg-[#3A342A] data-[active=true]:bg-[#EFE7CE]"
              data-active={i === 0}
            />
          ))}
        </div>
      </div>

      <footer
        className="pointer-events-none shrink-0 pb-6 pt-4 text-center"
        style={{ fontFamily: DISPLAY_FONT }}
      >
        <p
          className="text-[clamp(20px,3vw,28px)] tracking-[0.35em]"
          style={{ color: KONST.display }}
        >
          PRZEKRÓJ SEGMENTU
        </p>
        <p
          className="mt-1 text-[11px] tracking-[0.18em]"
          style={{ color: KONST.muted }}
        >
          {data.columns.length} etapów · {elementCount} elementów · {data.gapCount}{" "}
          luk
        </p>
      </footer>
    </div>
  );
}
