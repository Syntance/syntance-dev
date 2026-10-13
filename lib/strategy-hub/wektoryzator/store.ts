"use client";

/**
 * Stan edytora (zustand): źródło, ustawienia, dokument, historia edycji, zaznaczenie, widok.
 *
 * Wektoryzacja „na żywo” działa na dwóch workerach:
 *  - podglądowy liczy szybki podgląd roboczy (mniejsza rozdzielczość) zaraz po zmianie suwaka,
 *    miniatury presetów i podgląd presetu po najechaniu,
 *  - główny liczy pełną jakość po chwili bezczynności — jego wynik zastępuje podgląd.
 */
import { create } from "zustand";
import * as edits from "./doc-edits";
import type { TraceStats, VectorDocument } from "./engine/document";
import { buildLayers } from "./engine/layering";
import type { PipelineStage } from "./engine/pipeline";
import {
  DEFAULT_SETTINGS,
  DRAFT_EDGE,
  getPreset,
  LAYER_KEYS,
  needsOutline,
  needsRelayer,
  needsRetrace,
  OUTLINE_FIELDS,
  OUTLINE_KEYS,
  outlineFields,
  parseSettings,
  PRESETS,
  scaledSettings,
  THUMBNAIL_EDGE,
  type PresetId,
  type TraceSettings,
} from "./engine/settings";
import { checkInputFile } from "./file-input";
import { createUserPreset, loadUserPresets, MAX_USER_PRESETS, storeUserPresets, type UserPreset } from "./user-presets";
import { CancelledError, VectorizerEngine } from "./worker/engine-client";

export type ViewMode = "vector" | "compare" | "original" | "outline";
export type CanvasBackground = "checker" | "light" | "dark";
export type EditorStatus = "empty" | "loading" | "tracing" | "ready" | "error";

export interface SourceImage {
  name: string;
  size: number;
  url: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}

export interface ViewState {
  mode: ViewMode;
  zoom: number;
  x: number;
  y: number;
  /** Pozycja suwaka porównania 0–1. */
  split: number;
  exploded: boolean;
  background: CanvasBackground;
  gapFill: boolean;
  /** Zwiększany, gdy widok ma się dopasować do okna (obsługuje Viewport). */
  fitToken: number;
}

/** Podgląd roboczy: szybka wektoryzacja w mniejszej rozdzielczości. `label` = podgląd presetu (hover). */
export interface DraftPreview {
  doc: VectorDocument;
  label: string | null;
}

type Snapshot = edits.DocPatch;

const HISTORY_LIMIT = 60;
const SETTINGS_STORAGE_KEY = "wektoryzator:settings:v1";
/** Pełna jakość po tej chwili bezczynności; podgląd roboczy odpala się niemal od razu. */
const TRACE_DEBOUNCE_MS = 700;
const DRAFT_DEBOUNCE_MS = 70;
const PRESET_HOVER_DELAY_MS = 260;

export interface EditorState {
  status: EditorStatus;
  stage: PipelineStage | null;
  traceStartedAt: number | null;
  error: string | null;
  engineVersion: string | null;
  source: SourceImage | null;
  settings: TraceSettings;
  /** Ustawienia, z którymi powstał bieżący dokument. */
  tracedSettings: TraceSettings | null;
  autoTrace: boolean;
  doc: VectorDocument | null;
  stats: TraceStats | null;
  draft: DraftPreview | null;
  draftBusy: boolean;
  /** Miniatury presetów dla bieżącego obrazu (klucz: id presetu wbudowanego lub własnego). */
  presetThumbs: Record<string, VectorDocument>;
  userPresets: UserPreset[];
  activeUserPresetId: string | null;
  /** Zwiększany po pierwszej wektoryzacji nowego obrazu — animacja „przed/po”. */
  revealToken: number;
  past: Snapshot[];
  future: Snapshot[];
  selection: number[];
  hoverLayerId: string | null;
  exportOpen: boolean;
  view: ViewState;
  viewportSize: { width: number; height: number };
}

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

export interface EditorActions {
  hydrate(): void;
  openFile(file: File): Promise<void>;
  closeImage(): void;
  setSettings(patch: Partial<TraceSettings>): void;
  applyPreset(id: PresetId): void;
  /** Podgląd presetu na płótnie bez jego stosowania (null = koniec podglądu). */
  previewPreset(settings: TraceSettings | null, label?: string): void;
  saveUserPreset(name: string): void;
  updateUserPreset(id: string): void;
  renameUserPreset(id: string, name: string): void;
  deleteUserPreset(id: string): void;
  applyUserPreset(id: string): void;
  toggleOutlineVisible(): void;
  resetSettings(): void;
  setAutoTrace(value: boolean): void;
  retrace(): void;
  cancelTrace(): void;
  /** `coalesceKey`: kolejne zmiany z tym samym kluczem w krótkim czasie = jeden krok historii (np. przeciąganie koloru). */
  apply(update: (doc: VectorDocument) => edits.DocPatch, coalesceKey?: string): void;
  undo(): void;
  redo(): void;
  select(ids: readonly number[], mode?: "replace" | "add" | "toggle"): void;
  selectAll(): void;
  clearSelection(): void;
  deleteSelection(): void;
  setHoverLayer(id: string | null): void;
  setExportOpen(open: boolean): void;
  setView(patch: Partial<ViewState>): void;
  requestFit(): void;
  setViewportSize(size: { width: number; height: number }): void;
  /** Zoom o współczynnik wokół punktu ekranu (domyślnie środek płótna). */
  zoomAt(factor: number, anchor?: { x: number; y: number }): void;
  /** 100% = 1 piksel dokumentu na 1 piksel ekranu, wyśrodkowane. */
  zoomActual(): void;
}

let engine: VectorizerEngine | null = null;
function getEngine(): VectorizerEngine {
  engine ??= new VectorizerEngine();
  return engine;
}

let previewEngine: VectorizerEngine | null = null;
function getPreviewEngine(): VectorizerEngine {
  previewEngine ??= new VectorizerEngine();
  return previewEngine;
}

let traceTimer: ReturnType<typeof setTimeout> | null = null;
let traceRunning = false;
let traceQueued = false;

interface DraftRequest {
  settings: TraceSettings;
  label: string | null;
  token: number;
}
let draftTimer: ReturnType<typeof setTimeout> | null = null;
let draftRunning = false;
let draftQueued = false;
let draftRequest: DraftRequest | null = null;
let draftSeq = 0;
let thumbsToken = 0;
let outlineSeq = 0;

function persistSettings(settings: TraceSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Tryb prywatny / zablokowany storage — ustawienia działają w sesji.
  }
}

function snapshot(doc: VectorDocument): Snapshot {
  return { paths: doc.paths, swatches: doc.swatches, layers: doc.layers };
}

function layeringOptions(settings: TraceSettings) {
  return {
    strategy: settings.layering,
    maxLayers: settings.maxLayers,
    separateBackground: settings.separateBackground,
    groupObjects: settings.groupObjects,
    groupGap: settings.groupGap,
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Nieznany błąd.";
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useEditor = create<EditorState & EditorActions>()((set, get) => {
  // ── Pełna jakość ──────────────────────────────────────────────────────────
  const runTrace = async (): Promise<void> => {
    if (traceRunning) {
      traceQueued = true;
      return;
    }
    traceRunning = true;
    try {
      do {
        traceQueued = false;
        const { settings, source, doc } = get();
        if (!source) return;
        const firstForImage = doc === null;
        set({ status: "tracing", stage: "resize", traceStartedAt: performance.now(), error: null });
        const result = await getEngine().trace(settings, (stage) => set({ stage }));
        if (traceQueued) continue;
        if (get().source !== source) return;
        // Podgląd roboczy jest już nieaktualny; podgląd presetu (hover) zostaje.
        if (draftRequest && draftRequest.label === null) draftRequest = null;
        set((state) => ({
          status: "ready",
          stage: null,
          traceStartedAt: null,
          doc: result.doc,
          stats: result.stats,
          tracedSettings: settings,
          draft: state.draft?.label ? state.draft : null,
          past: [],
          future: [],
          selection: [],
          revealToken: firstForImage ? state.revealToken + 1 : state.revealToken,
          view: firstForImage ? { ...state.view, fitToken: state.view.fitToken + 1 } : state.view,
        }));
        if (firstForImage) void buildThumbnails();
      } while (traceQueued);
    } catch (error) {
      if (error instanceof CancelledError) {
        // Anulowanie przez nowy plik ustawia już stan „loading” — nie nadpisujemy go.
        if (get().status === "tracing") {
          set((state) => ({ status: state.doc ? "ready" : "empty", stage: null, traceStartedAt: null }));
        }
      } else {
        set({ status: "error", stage: null, traceStartedAt: null, error: message(error) });
      }
    } finally {
      traceRunning = false;
    }
  };

  const scheduleTrace = (delay: number) => {
    if (traceTimer) clearTimeout(traceTimer);
    traceTimer = setTimeout(() => {
      traceTimer = null;
      void runTrace();
    }, delay);
  };

  // ── Podgląd roboczy (na żywo) ─────────────────────────────────────────────
  const runDraft = async (): Promise<void> => {
    if (draftRunning) {
      draftQueued = true;
      return;
    }
    draftRunning = true;
    set({ draftBusy: true });
    try {
      do {
        draftQueued = false;
        const request = draftRequest;
        if (!request) break;
        const source = get().source;
        const result = await getPreviewEngine().trace(request.settings);
        if (draftRequest?.token !== request.token || get().source !== source) continue;
        set({ draft: { doc: result.doc, label: request.label } });
      } while (draftQueued);
    } catch {
      // Podgląd jest pomocniczy — błędy raportuje pełna wektoryzacja.
    } finally {
      draftRunning = false;
      set({ draftBusy: false });
      // Żądanie, które przyszło w trakcie ostatniego przebiegu, mogło nie zostać obsłużone.
      if (draftRequest && get().draft?.doc !== undefined && draftQueued) void runDraft();
    }
  };

  const requestDraft = (settings: TraceSettings, label: string | null, delay: number) => {
    const source = get().source;
    if (!source || source.width === 0) return;
    const draftSettings = scaledSettings(settings, source.width, source.height, DRAFT_EDGE);
    if (!draftSettings) {
      // Mały obraz — pełna jakość jest równie szybka. Podgląd presetu liczymy wtedy w pełnej rozdzielczości.
      if (label === null) return;
      draftRequest = { settings, label, token: ++draftSeq };
    } else {
      draftRequest = { settings: draftSettings, label, token: ++draftSeq };
    }
    if (draftTimer) clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      draftTimer = null;
      void runDraft();
    }, delay);
  };

  // ── Miniatury presetów ─────────────────────────────────────────────────────
  const buildThumbnails = async (): Promise<void> => {
    const token = ++thumbsToken;
    const source = get().source;
    if (!source || source.width === 0) return;
    const items = [
      ...PRESETS.map((p) => ({ key: p.id, settings: p.settings })),
      ...get().userPresets.map((p) => ({ key: p.id, settings: p.settings })),
    ];
    for (const item of items) {
      if (thumbsToken !== token || get().source !== source) return;
      if (get().presetThumbs[item.key]) continue;
      // Pierwszeństwo dla podglądu na żywo.
      while ((draftRunning || draftTimer !== null) && thumbsToken === token) await wait(120);
      const settings =
        scaledSettings(item.settings, source.width, source.height, THUMBNAIL_EDGE) ??
        ({ ...item.settings, workingSize: 256 } satisfies TraceSettings);
      try {
        const result = await getPreviewEngine().trace({ ...settings, groupObjects: false, layering: "single" });
        if (thumbsToken !== token || get().source !== source) return;
        set((state) => ({ presetThumbs: { ...state.presetThumbs, [item.key]: result.doc } }));
      } catch {
        return;
      }
    }
  };

  // ── Historia edycji ───────────────────────────────────────────────────────
  let lastCoalesce: { key: string; at: number } | null = null;

  const commit = (next: Snapshot, coalesceKey?: string) => {
    const { doc, past } = get();
    if (!doc) return;
    if (next.paths === doc.paths && next.swatches === doc.swatches && next.layers === doc.layers) return;
    const now = Date.now();
    const coalesce = coalesceKey !== undefined && lastCoalesce?.key === coalesceKey && now - lastCoalesce.at < 1200;
    lastCoalesce = coalesceKey === undefined ? null : { key: coalesceKey, at: now };
    set({
      doc: { ...doc, ...next },
      past: coalesce ? past : [...past, snapshot(doc)].slice(-HISTORY_LIMIT),
      future: [],
    });
  };

  const applySettings = (next: TraceSettings, userPresetId: string | null = null) => {
    const { doc, tracedSettings, autoTrace } = get();
    set({ settings: next, activeUserPresetId: userPresetId });
    persistSettings(next);
    if (!doc || !tracedSettings) return;
    if (needsRelayer(tracedSettings, next)) {
      commit({ ...doc, layers: buildLayers(doc, layeringOptions(next)) });
      const layered: Partial<TraceSettings> = {};
      for (const key of LAYER_KEYS) Object.assign(layered, { [key]: next[key] });
      set({ tracedSettings: { ...tracedSettings, ...layered }, selection: [] });
    }
    if (needsRetrace(tracedSettings, next)) {
      if (autoTrace) {
        requestDraft(next, null, DRAFT_DEBOUNCE_MS);
        scheduleTrace(TRACE_DEBOUNCE_MS);
      }
    } else if (needsOutline(tracedSettings, next)) {
      void refreshOutline(next);
    }
  };

  // ── Obrys całości (bez ponownej wektoryzacji grafiki) ──────────────────────
  const refreshOutline = async (settings: TraceSettings): Promise<void> => {
    const token = ++outlineSeq;
    if (!get().doc) return;
    try {
      const outline = settings.outline ? await getEngine().outline(settings) : null;
      const { doc, tracedSettings } = get();
      if (token !== outlineSeq || !doc || !tracedSettings) return;
      const geometry: Partial<TraceSettings> = {};
      for (const key of OUTLINE_KEYS) Object.assign(geometry, { [key]: settings[key] });
      set({ doc: { ...doc, outline }, tracedSettings: { ...tracedSettings, ...geometry } });
    } catch (error) {
      if (!(error instanceof CancelledError)) set({ error: message(error) });
    }
  };

  const persistPresets = (presets: UserPreset[]) => {
    set({ userPresets: presets });
    storeUserPresets(presets);
  };

  return {
    status: "empty",
    stage: null,
    traceStartedAt: null,
    error: null,
    engineVersion: null,
    source: null,
    settings: DEFAULT_SETTINGS,
    tracedSettings: null,
    autoTrace: true,
    doc: null,
    stats: null,
    draft: null,
    draftBusy: false,
    presetThumbs: {},
    userPresets: [],
    activeUserPresetId: null,
    revealToken: 0,
    past: [],
    future: [],
    selection: [],
    hoverLayerId: null,
    exportOpen: false,
    view: {
      mode: "vector",
      zoom: 1,
      x: 0,
      y: 0,
      split: 0.5,
      exploded: false,
      background: "checker",
      gapFill: true,
      fitToken: 0,
    },
    viewportSize: { width: 0, height: 0 },

    hydrate() {
      try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) set({ settings: parseSettings(JSON.parse(raw)) });
      } catch {
        // Brak dostępu do storage — zostają domyślne.
      }
      set({ userPresets: loadUserPresets() });
      // Rozgrzanie silników w tle: pobranie i kompilacja WASM zanim użytkownik wybierze plik.
      getEngine()
        .ready()
        .then((version) => set({ engineVersion: version }))
        .catch((error: unknown) => {
          if (!(error instanceof CancelledError)) set({ error: message(error) });
        });
      getPreviewEngine()
        .ready()
        .catch(() => {});
    },

    async openFile(file) {
      const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
      const check = checkInputFile(file.name, file.size, head);
      if (!check.ok) {
        set({ error: check.message, status: get().doc ? "ready" : "empty" });
        return;
      }
      if (traceTimer) clearTimeout(traceTimer);
      if (draftTimer) clearTimeout(draftTimer);
      draftRequest = null;
      thumbsToken++;
      getEngine().cancel();
      getPreviewEngine().cancel();
      const previous = get().source;
      if (previous) URL.revokeObjectURL(previous.url);
      const url = URL.createObjectURL(file);
      set({
        status: "loading",
        stage: "decode",
        traceStartedAt: performance.now(),
        error: null,
        source: { name: file.name, size: file.size, url, width: 0, height: 0, hasAlpha: false },
        doc: null,
        stats: null,
        draft: null,
        presetThumbs: {},
        tracedSettings: null,
        past: [],
        future: [],
        selection: [],
        view: { ...get().view, mode: "vector", exploded: false },
      });
      try {
        const bytes = await file.arrayBuffer();
        const previewLoad = getPreviewEngine()
          .load(bytes)
          .catch(() => null);
        const info = await getEngine().load(bytes);
        const current = get().source;
        if (!current || current.url !== url) return;
        set({ source: { ...current, ...info } });
        // Szybki podgląd roboczy, zanim pełna jakość będzie gotowa.
        void previewLoad.then((loaded) => {
          if (loaded && get().source?.url === url && get().doc === null) requestDraft(get().settings, null, 0);
        });
        await runTrace();
      } catch (error) {
        if (error instanceof CancelledError) return;
        set({ status: "error", stage: null, error: message(error) });
      }
    },

    closeImage() {
      if (traceTimer) clearTimeout(traceTimer);
      if (draftTimer) clearTimeout(draftTimer);
      draftRequest = null;
      thumbsToken++;
      getEngine().cancel();
      getPreviewEngine().cancel();
      const source = get().source;
      if (source) URL.revokeObjectURL(source.url);
      set({
        status: "empty",
        stage: null,
        error: null,
        source: null,
        doc: null,
        stats: null,
        draft: null,
        presetThumbs: {},
        tracedSettings: null,
        past: [],
        future: [],
        selection: [],
      });
    },

    setSettings(patch) {
      const current = get().settings;
      // Obrys nie zmienia presetu na „własny” — jest dodatkiem do dowolnego stylu.
      const changesValues = Object.entries(patch).some(
        ([key, value]) => key !== "preset" && !OUTLINE_FIELDS.has(key) && Reflect.get(current, key) !== value,
      );
      applySettings(parseSettings({ ...current, ...patch, preset: changesValues ? "custom" : current.preset }));
    },

    applyPreset(id) {
      draftRequest = null;
      set({ draft: null });
      applySettings({ ...getPreset(id).settings, ...outlineFields(get().settings) });
    },

    previewPreset(settings, label) {
      if (!settings) {
        if (draftTimer && draftRequest?.label) clearTimeout(draftTimer);
        if (draftRequest?.label) draftRequest = null;
        if (get().draft?.label) set({ draft: null });
        return;
      }
      if (!get().doc) return;
      requestDraft(settings, label ?? "Podgląd", PRESET_HOVER_DELAY_MS);
    },

    saveUserPreset(name) {
      const presets = get().userPresets;
      if (presets.length >= MAX_USER_PRESETS) {
        set({ error: `Możesz zapisać maksymalnie ${MAX_USER_PRESETS} presetów.` });
        return;
      }
      const preset = createUserPreset(name, get().settings);
      persistPresets([...presets, preset]);
      set({ activeUserPresetId: preset.id });
      void buildThumbnails();
    },

    updateUserPreset(id) {
      const settings = get().settings;
      persistPresets(
        get().userPresets.map((p) => (p.id === id ? { ...p, settings: { ...settings, preset: "custom" } } : p)),
      );
      set((state) => {
        const thumbs = { ...state.presetThumbs };
        delete thumbs[id];
        return { presetThumbs: thumbs, activeUserPresetId: id };
      });
      void buildThumbnails();
    },

    renameUserPreset(id, name) {
      const trimmed = name.trim().slice(0, 40);
      if (!trimmed) return;
      persistPresets(get().userPresets.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    },

    deleteUserPreset(id) {
      persistPresets(get().userPresets.filter((p) => p.id !== id));
      if (get().activeUserPresetId === id) set({ activeUserPresetId: null });
    },

    applyUserPreset(id) {
      const preset = get().userPresets.find((p) => p.id === id);
      if (!preset) return;
      draftRequest = null;
      set({ draft: null });
      applySettings(parseSettings({ ...preset.settings, preset: "custom" }), id);
    },

    toggleOutlineVisible() {
      const doc = get().doc;
      if (doc?.outline) set({ doc: { ...doc, outline: { ...doc.outline, visible: !doc.outline.visible } } });
    },

    resetSettings() {
      applySettings(DEFAULT_SETTINGS);
    },

    setAutoTrace(value) {
      set({ autoTrace: value });
      const { doc, tracedSettings, settings } = get();
      if (value && doc && tracedSettings && needsRetrace(tracedSettings, settings)) scheduleTrace(0);
    },

    retrace() {
      if (traceTimer) clearTimeout(traceTimer);
      void runTrace();
    },

    cancelTrace() {
      if (traceTimer) clearTimeout(traceTimer);
      traceQueued = false;
      getEngine().cancel();
    },

    apply(update, coalesceKey) {
      const doc = get().doc;
      if (!doc) return;
      commit(update(doc), coalesceKey);
      const next = get().doc;
      if (next) {
        const selectable = new Set(edits.selectablePathIds(next));
        set({ selection: get().selection.filter((id) => selectable.has(id)) });
      }
    },

    undo() {
      const { doc, past, future } = get();
      const previous = past[past.length - 1];
      if (!doc || !previous) return;
      set({ doc: { ...doc, ...previous }, past: past.slice(0, -1), future: [snapshot(doc), ...future], selection: [] });
    },

    redo() {
      const { doc, past, future } = get();
      const next = future[0];
      if (!doc || !next) return;
      set({ doc: { ...doc, ...next }, past: [...past, snapshot(doc)], future: future.slice(1), selection: [] });
    },

    select(ids, mode = "replace") {
      if (mode === "replace") {
        set({ selection: [...new Set(ids)] });
        return;
      }
      const current = new Set(get().selection);
      for (const id of ids) {
        if (mode === "toggle" && current.has(id)) current.delete(id);
        else current.add(id);
      }
      set({ selection: [...current] });
    },

    selectAll() {
      const doc = get().doc;
      if (doc) set({ selection: edits.selectablePathIds(doc) });
    },

    clearSelection() {
      if (get().selection.length > 0) set({ selection: [] });
    },

    deleteSelection() {
      const { doc, selection } = get();
      if (!doc || selection.length === 0) return;
      commit(edits.removePaths(doc, selection));
      set({ selection: [] });
    },

    setHoverLayer(id) {
      if (get().hoverLayerId !== id) set({ hoverLayerId: id });
    },

    setExportOpen(open) {
      set({ exportOpen: open });
    },

    setView(patch) {
      set({ view: { ...get().view, ...patch } });
    },

    requestFit() {
      set({ view: { ...get().view, fitToken: get().view.fitToken + 1 } });
    },

    setViewportSize(size) {
      const current = get().viewportSize;
      if (current.width !== size.width || current.height !== size.height) set({ viewportSize: size });
    },

    zoomAt(factor, anchor) {
      const { view, viewportSize } = get();
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.zoom * factor));
      const k = zoom / view.zoom;
      const ax = anchor?.x ?? viewportSize.width / 2;
      const ay = anchor?.y ?? viewportSize.height / 2;
      set({ view: { ...view, zoom, x: ax - (ax - view.x) * k, y: ay - (ay - view.y) * k } });
    },

    zoomActual() {
      const { view, viewportSize, doc } = get();
      if (!doc) return;
      set({
        view: {
          ...view,
          zoom: 1,
          x: (viewportSize.width - doc.width) / 2,
          y: (viewportSize.height - doc.height) / 2,
        },
      });
    },
  };
});

/** Czy bieżące ustawienia różnią się od tych, z którymi powstał dokument (geometria). */
export function useNeedsRetrace(): boolean {
  return useEditor((s) => (s.doc && s.tracedSettings ? needsRetrace(s.tracedSettings, s.settings) : false));
}
