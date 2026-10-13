"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ImageUp, Redo2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_INPUT } from "@/lib/strategy-hub/wektoryzator/file-input";
import { useEditor, type ViewMode } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { formatBytes, formatNumber, IconButton } from "./controls";
import { EmptyState } from "./empty-state";
import { ExportDialog } from "./export-dialog";
import { LayersPanel } from "./layers-panel";
import { PalettePanel } from "./palette-panel";
import { SelectionPanel } from "./selection-panel";
import { SettingsPanel } from "./settings-panel";
import { Viewport } from "./viewport";

const MODE_KEYS: Record<string, ViewMode> = { "1": "vector", "2": "compare", "3": "original", "4": "outline" };

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

/**
 * Skróty edytora. Nasłuch w fazie capture: gdy obsłużymy klawisz, zatrzymujemy propagację, żeby
 * globalne skróty Strategy Huba (np. Ctrl+Z dla edycji strategii) nie odpaliły równolegle.
 * Ctrl+K (paleta komend) i pozostałe skróty huba przechodzą bez zmian.
 */
function useEditorShortcuts(openPicker: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const state = useEditor.getState();
      if (state.exportOpen) return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      let handled = true;
      if (mod && key === "z" && !event.shiftKey) state.undo();
      else if (mod && ((key === "z" && event.shiftKey) || key === "y")) state.redo();
      else if (mod && key === "o") openPicker();
      else if (mod && (key === "e" || key === "s")) {
        if (state.doc) state.setExportOpen(true);
      } else if (mod && key === "a") state.selectAll();
      else if (mod && key === "enter") state.retrace();
      else if (mod && key === "1") state.zoomActual();
      else if (mod) handled = false;
      else if (key === "delete" || key === "backspace") state.deleteSelection();
      else if (key === "escape") state.clearSelection();
      else if (MODE_KEYS[key] && state.doc) state.setView({ mode: MODE_KEYS[key] });
      else if (key === "0") state.requestFit();
      else if (key === "+" || key === "=") state.zoomAt(1.25);
      else if (key === "-" || key === "_") state.zoomAt(1 / 1.25);
      else handled = false;
      if (handled) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [openPicker]);
}

/** Wklejanie obrazu ze schowka (Ctrl+V). */
function usePasteImage() {
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      void useEditor.getState().openFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);
}

function SidePanel() {
  const [tab, setTab] = useState<"layers" | "palette">("layers");
  const doc = useEditor((s) => s.doc);
  const tabs = [
    { id: "layers" as const, label: "Warstwy", count: doc?.layers.length },
    {
      id: "palette" as const,
      label: "Paleta",
      count: doc ? new Set(doc.paths.filter((p) => !p.removed).map((p) => p.swatch)).size : undefined,
    },
  ];
  return (
    <aside
      aria-label="Warstwy i paleta"
      className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card lg:min-h-0"
    >
      <div role="tablist" aria-label="Panel boczny" className="flex shrink-0 gap-1 border-b border-border p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`wkz-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`wkz-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="rounded bg-background/70 px-1 font-mono text-[10px] tabular-nums">{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div
        id={`wkz-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`wkz-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {tab === "layers" ? <LayersPanel /> : <PalettePanel />}
      </div>
      <SelectionPanel />
    </aside>
  );
}

export function WektoryzatorApp() {
  const source = useEditor((s) => s.source);
  const status = useEditor((s) => s.status);
  const doc = useEditor((s) => s.doc);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const openFile = useEditor((s) => s.openFile);
  const closeImage = useEditor((s) => s.closeImage);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const setExportOpen = useEditor((s) => s.setExportOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = useCallback(() => inputRef.current?.click(), []);

  useEffect(() => {
    useEditor.getState().hydrate();
  }, []);
  useEditorShortcuts(openPicker);
  usePasteImage();

  const hasImage = source !== null && status !== "empty";

  return (
    <div className="flex h-full min-h-[640px] w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs text-muted-foreground">Custom Apps</p>
          <h1 className="text-2xl font-semibold tracking-tight">Wektoryzator</h1>
          {hasImage && source ? (
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {source.name}
              {source.width > 0 ? ` · ${formatNumber(source.width)}×${formatNumber(source.height)} px` : ""} ·{" "}
              {formatBytes(source.size)}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Zdjęcia i grafiki rastrowe → precyzyjny wektor z automatycznymi warstwami.
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {hasImage ? (
            <>
              <IconButton label="Cofnij" shortcut="Ctrl+Z" disabled={!canUndo} onClick={undo}>
                <Undo2 />
              </IconButton>
              <IconButton label="Ponów" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={redo}>
                <Redo2 />
              </IconButton>
              <IconButton label="Zamknij obraz" onClick={closeImage}>
                <X />
              </IconButton>
              <Button variant="outline" onClick={openPicker}>
                <ImageUp className="size-4" /> Inny obraz
              </Button>
              <Button onClick={() => setExportOpen(true)} disabled={!doc}>
                <Download className="size-4" /> Eksportuj
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_INPUT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openFile(file);
          event.target.value = "";
        }}
      />

      {hasImage ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[264px_minmax(0,1fr)_288px] lg:grid-rows-[minmax(0,1fr)] 2xl:grid-cols-[288px_minmax(0,1fr)_320px]">
          <div className="order-2 min-h-0 lg:order-1 lg:flex lg:flex-col">
            <SettingsPanel />
          </div>
          <div className="order-1 flex min-h-[460px] flex-col lg:order-2 lg:min-h-0">
            <Viewport />
          </div>
          <div className="order-3 min-h-0 lg:flex lg:flex-col">
            <SidePanel />
          </div>
        </div>
      ) : (
        <EmptyState onPick={openPicker} />
      )}

      <ExportDialog />
    </div>
  );
}
