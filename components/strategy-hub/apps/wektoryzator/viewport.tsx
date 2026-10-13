"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { Boxes, Grid2x2Check, Loader2, Maximize, Minus, Moon, Plus, Sparkles, Sun, SquareDashed } from "lucide-react";
import { layerOfPath } from "@/lib/strategy-hub/wektoryzator/doc-edits";
import { outlineStyle } from "@/lib/strategy-hub/wektoryzator/engine/settings";
import { MIN_ZOOM, useEditor, type CanvasBackground, type ViewMode } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { IconButton, Segmented } from "./controls";
import { ProgressOverlay } from "./progress-overlay";
import { StatsBar } from "./stats-bar";
import { SelectionOverlay, VectorStage } from "./vector-stage";
import styles from "./wektoryzator.module.css";

const VIEW_MODES: { value: ViewMode; label: string }[] = [
  { value: "vector", label: "Wektor" },
  { value: "compare", label: "Przed / po" },
  { value: "original", label: "Oryginał" },
  { value: "outline", label: "Kontury" },
];

const BACKGROUNDS: CanvasBackground[] = ["checker", "light", "dark"];
const BACKGROUND_LABELS: Record<CanvasBackground, string> = {
  checker: "Tło: szachownica",
  light: "Tło: jasne",
  dark: "Tło: ciemne",
};

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

export function Viewport() {
  const doc = useEditor((s) => s.doc);
  const draft = useEditor((s) => s.draft);
  const settings = useEditor((s) => s.settings);
  const status = useEditor((s) => s.status);
  const source = useEditor((s) => s.source);
  const view = useEditor((s) => s.view);
  const selection = useEditor((s) => s.selection);
  const hoverLayerId = useEditor((s) => s.hoverLayerId);
  const revealToken = useEditor((s) => s.revealToken);
  const setView = useEditor((s) => s.setView);
  const zoomAt = useEditor((s) => s.zoomAt);
  const select = useEditor((s) => s.select);
  const clearSelection = useEditor((s) => s.clearSelection);

  const containerRef = useRef<HTMLDivElement>(null);
  const spaceDown = useRef(false);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const splitDrag = useRef(false);

  // Scena ma wymiary pełnego dokumentu; podgląd roboczy (mniejsza rozdzielczość) skaluje się do niej.
  const displayDoc = draft?.doc ?? doc;
  const docWidth = doc?.width ?? draft?.doc.width ?? source?.width ?? 0;
  const docHeight = doc?.height ?? draft?.doc.height ?? source?.height ?? 0;
  const displayOutline =
    displayDoc && settings.outline ? outlineStyle(settings, displayDoc.width, displayDoc.height) : null;

  const fit = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (!el || docWidth === 0 || docHeight === 0) return;
      const { width, height } = el.getBoundingClientRect();
      const pad = 36;
      const zoom = Math.max(MIN_ZOOM, Math.min((width - pad * 2) / docWidth, (height - pad * 2) / docHeight) * factor);
      setView({ zoom, x: (width - docWidth * zoom) / 2, y: (height - docHeight * zoom) / 2 });
    },
    [docWidth, docHeight, setView],
  );

  // Dopasowanie: na żądanie (fitToken) i przy przełączeniu widoku 3D.
  useEffect(() => {
    fit(view.exploded ? 0.62 : 1);
  }, [view.fitToken, view.exploded, fit]);

  // Rozmiar płótna → store (zoom wokół środka z klawiatury).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      useEditor.getState().setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Kółko myszy / pinch = zoom wokół kursora (nasłuch nie-pasywny, żeby zablokować przewijanie strony).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0016));
      useEditor.getState().zoomAt(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Spacja = tymczasowa rączka (przesuwanie).
  useEffect(() => {
    const down = (event: globalThis.KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        spaceDown.current = true;
        if (containerRef.current) containerRef.current.style.cursor = "grab";
        // Bez fokusu na kontrolce spacja przewijałaby stronę zamiast przesuwać płótno.
        if (event.target === document.body) event.preventDefault();
      }
    };
    const up = (event: globalThis.KeyboardEvent) => {
      if (event.code === "Space") {
        spaceDown.current = false;
        if (containerRef.current) containerRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Moment „przed/po”: po pierwszej wektoryzacji linia skanu odsłania wektor (bez animacji przy reduced-motion).
  useEffect(() => {
    if (revealToken === 0) return;
    const { setView: set } = useEditor.getState();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set({ mode: "compare", split: 0.5 });
      return;
    }
    set({ mode: "compare", split: 1 });
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1100);
      const eased = 1 - (1 - t) ** 3;
      useEditor.getState().setView({ split: 1 - 0.5 * eased });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [revealToken]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const panning = event.button === 1 || (event.button === 0 && spaceDown.current);
    if (panning) {
      event.preventDefault();
      drag.current = { x: event.clientX, y: event.clientY, vx: view.x, vy: view.y };
      el.setPointerCapture(event.pointerId);
      el.style.cursor = "grabbing";
      return;
    }
    if (event.button !== 0 || !doc || draft || view.mode === "original") return;
    const target = event.target;
    if (target instanceof SVGPathElement && target.dataset.id !== undefined) {
      const id = Number(target.dataset.id);
      const path = doc.paths[id];
      if (!path) return;
      if (event.altKey) {
        const sameColor = doc.paths.filter((p) => !p.removed && p.swatch === path.swatch).map((p) => p.id);
        select(sameColor, event.shiftKey ? "add" : "replace");
      } else {
        select([id], event.shiftKey ? "toggle" : "replace");
      }
    } else if (!event.shiftKey) {
      clearSelection();
    }
  };

  const onDoubleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!doc || draft) return;
    const target = event.target;
    if (!(target instanceof SVGPathElement) || target.dataset.id === undefined) return;
    const id = Number(target.dataset.id);
    const group = layerOfPath(doc, id)?.groups.find((g) => g.pathIds.includes(id));
    if (group) select(group.pathIds, event.shiftKey ? "add" : "replace");
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (splitDrag.current) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || docWidth === 0) return;
      const local = (event.clientX - rect.left - view.x) / (docWidth * view.zoom);
      setView({ split: Math.min(1, Math.max(0, local)) });
      return;
    }
    if (!drag.current) return;
    setView({
      x: drag.current.vx + event.clientX - drag.current.x,
      y: drag.current.vy + event.clientY - drag.current.y,
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    splitDrag.current = false;
    if (!drag.current) return;
    drag.current = null;
    const el = containerRef.current;
    if (el?.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    if (el) el.style.cursor = spaceDown.current ? "grab" : "";
  };

  const onSplitKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === "ArrowLeft") setView({ split: Math.max(0, view.split - step) });
    else if (event.key === "ArrowRight") setView({ split: Math.min(1, view.split + step) });
    else if (event.key === "Home") setView({ split: 0 });
    else if (event.key === "End") setView({ split: 1 });
    else return;
    event.preventDefault();
    event.stopPropagation();
  };

  const showOriginal = view.mode !== "vector" && source !== null;
  const showVector = view.mode !== "original" && displayDoc !== null;
  const clipPath = view.mode === "compare" ? `inset(0 0 0 ${view.split * 100}%)` : undefined;
  const nextBackground = BACKGROUNDS[(BACKGROUNDS.indexOf(view.background) + 1) % BACKGROUNDS.length];
  const splitX = view.x + docWidth * view.zoom * view.split;

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
      <div
        ref={containerRef}
        role="region"
        aria-label="Podgląd wektora"
        className={cn(
          "relative min-h-0 flex-1 cursor-default overflow-hidden",
          styles.canvas,
          view.background === "checker" ? styles.checker : view.background === "light" ? styles.light : styles.dark,
        )}
        style={{ perspective: view.exploded ? "2400px" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={onDoubleClick}
        onAuxClick={(e) => e.preventDefault()}
      >
        {docWidth > 0 ? (
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{
              width: docWidth,
              height: docHeight,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
              transformStyle: view.exploded ? "preserve-3d" : undefined,
            }}
          >
            <div
              className={cn("absolute inset-0", styles.explodable)}
              style={{ transform: view.exploded ? "rotateX(52deg) rotateZ(-32deg)" : undefined }}
            >
              {showOriginal && source ? (
                // eslint-disable-next-line @next/next/no-img-element -- lokalny blob URL, next/image go nie zoptymalizuje
                <img
                  src={source.url}
                  alt="Oryginalny obraz"
                  draggable={false}
                  className="absolute inset-0 size-full select-none"
                  style={{
                    opacity: view.mode === "outline" ? 0.35 : 1,
                    imageRendering: view.zoom > 3 ? "pixelated" : undefined,
                  }}
                />
              ) : null}
              {showVector && displayDoc ? (
                <VectorStage
                  doc={displayDoc}
                  width={docWidth}
                  height={docHeight}
                  gapFill={view.gapFill}
                  outline={view.mode === "outline"}
                  outlineStyle={displayOutline}
                  exploded={view.exploded}
                  zoom={view.zoom}
                  hoverLayerId={draft ? null : hoverLayerId}
                  clipPath={clipPath}
                  interactive={!draft}
                />
              ) : null}
              {doc && !draft && !view.exploded ? <SelectionOverlay doc={doc} selection={selection} /> : null}
            </div>
          </div>
        ) : null}

        {view.mode === "compare" && displayDoc && !view.exploded ? (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Podział przed / po"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(view.split * 100)}
            aria-valuetext={`Oryginał ${Math.round(view.split * 100)}%, wektor ${100 - Math.round(view.split * 100)}%`}
            onKeyDown={onSplitKey}
            onPointerDown={(event) => {
              event.stopPropagation();
              splitDrag.current = true;
              containerRef.current?.setPointerCapture(event.pointerId);
            }}
            className="group absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-ew-resize focus-visible:outline-none"
            style={{ left: splitX }}
          >
            <div className={cn(styles.traceLine, "left-1/2 -translate-x-1/2")} />
            <div className="absolute left-1/2 top-1/2 flex h-9 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/60 bg-card text-[10px] font-semibold text-primary shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
              ⇆
            </div>
            <span className="pointer-events-none absolute left-full top-3 ml-2 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
              wektor
            </span>
            <span className="pointer-events-none absolute right-full top-3 mr-2 rounded bg-card/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
              oryginał
            </span>
          </div>
        ) : null}

        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
          <Segmented
            size="sm"
            label="Tryb podglądu"
            value={view.mode}
            onChange={(mode) => setView({ mode })}
            options={VIEW_MODES}
            className="w-auto border-0 bg-transparent"
          />
          <span className="mx-0.5 h-5 w-px bg-border" aria-hidden />
          <IconButton
            label="Rozłóż warstwy w 3D"
            active={view.exploded}
            disabled={!doc}
            onClick={() => setView({ exploded: !view.exploded })}
          >
            <Boxes />
          </IconButton>
          <IconButton
            label="Wypełniacz szczelin (ukrywa jasne rysy na stykach kształtów)"
            active={view.gapFill}
            disabled={!doc}
            onClick={() => setView({ gapFill: !view.gapFill })}
          >
            <Grid2x2Check />
          </IconButton>
          <IconButton label={BACKGROUND_LABELS[nextBackground]} onClick={() => setView({ background: nextBackground })}>
            {view.background === "checker" ? <SquareDashed /> : view.background === "light" ? <Sun /> : <Moon />}
          </IconButton>
        </div>

        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-0.5 rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur">
          <IconButton label="Pomniejsz" shortcut="−" onClick={() => zoomAt(1 / 1.25)}>
            <Minus />
          </IconButton>
          <button
            type="button"
            onClick={() => useEditor.getState().zoomActual()}
            title="Rozmiar rzeczywisty (Ctrl+1)"
            className="h-8 min-w-14 rounded-md px-1.5 font-mono text-[11px] tabular-nums text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Math.round(view.zoom * 100)}%
          </button>
          <IconButton label="Powiększ" shortcut="+" onClick={() => zoomAt(1.25)}>
            <Plus />
          </IconButton>
          <IconButton label="Dopasuj do okna" shortcut="0" onClick={() => fit(view.exploded ? 0.62 : 1)}>
            <Maximize />
          </IconButton>
        </div>

        {draft ? (
          <div
            role="status"
            className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card/95 px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur"
          >
            {draft.label ? <Sparkles className="size-3.5 text-primary" aria-hidden /> : null}
            {!draft.label && status === "tracing" ? (
              <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
            ) : null}
            {draft.label
              ? `Podgląd presetu: ${draft.label}`
              : status === "tracing"
                ? "Podgląd na żywo · liczę pełną jakość…"
                : "Podgląd na żywo"}
          </div>
        ) : null}
        <ProgressOverlay />
      </div>
      <StatsBar />
    </div>
  );
}
