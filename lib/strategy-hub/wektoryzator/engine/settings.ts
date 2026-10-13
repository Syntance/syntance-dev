/**
 * Ustawienia wektoryzacji: jeden schemat Zod (UI, localStorage, Web Worker), presety i mapowanie
 * na opcje silnika VTracer.
 */
import { z } from "zod";
import { fitWorkingSize } from "./image";

export const PRESET_IDS = ["photo", "photo-max", "illustration", "logo", "poster", "lineart", "scan", "pixel"] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const LAYERING_STRATEGIES = ["auto", "color", "tone", "hue", "size", "single"] as const;
export type LayeringStrategy = (typeof LAYERING_STRATEGIES)[number];

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const traceSettingsSchema = z.object({
  preset: z.enum([...PRESET_IDS, "custom"]),
  /** `palette` — kolory z palety k-means; `bw` — czarno-białe (próg stały lub adaptacyjny). */
  colorMode: z.enum(["palette", "bw"]),
  colors: int(2, 256),
  autoColors: z.boolean(),
  /** 0–5: wygładzanie z zachowaniem krawędzi przed kwantyzacją. */
  smoothing: int(0, 5),
  /** Bok najmniejszej plamy w px (mniejsze są wchłaniane przez sąsiadów). */
  speckle: int(0, 64),
  /** Dłuższa krawędź obrazu roboczego w px. */
  workingSize: int(256, 8000),
  upscale: z.boolean(),
  curveMode: z.enum(["spline", "polygon", "pixel"]),
  cornerThreshold: int(0, 180),
  lengthThreshold: z.number().min(3.5).max(10),
  spliceThreshold: int(0, 180),
  /** Tolerancja upraszczania krzywych w px (0 = wyłączone). */
  simplify: z.number().min(0).max(4),
  /** `cutout` — mozaika bez nakładania (wspólne krawędzie); `stacked` — kształty ułożone w stos. */
  layout: z.enum(["cutout", "stacked"]),
  pathPrecision: int(0, 3),
  bwThreshold: int(1, 254),
  bwAdaptive: z.boolean(),
  alphaThreshold: int(1, 255),
  layering: z.enum(LAYERING_STRATEGIES),
  maxLayers: int(2, 32),
  separateBackground: z.boolean(),
  groupObjects: z.boolean(),
  /** Odległość łączenia kształtów w obiekty, % przekątnej obrazu. */
  groupGap: z.number().min(0).max(10),
  /** Obrys całości — jednolity kontur wokół całego elementu. */
  outline: z.boolean(),
  /** `line` — sama linia (kontur cięcia); `backing` — jednolity podkład pod grafiką. */
  outlineMode: z.enum(["line", "backing"]),
  /** Odsunięcie konturu od krawędzi elementu, % dłuższego boku. */
  outlineOffset: z.number().min(0).max(10),
  /** Grubość linii obrysu, % dłuższego boku. */
  outlineWidth: z.number().min(0.05).max(4),
  outlineColor: z.string().regex(/^#[0-9a-f]{6}$/),
  /** Tylko kontur zewnętrzny (otwory wewnątrz elementu wypełnione). */
  outlineFillHoles: z.boolean(),
});

export type TraceSettings = z.infer<typeof traceSettingsSchema>;

const BASE: Omit<TraceSettings, "preset"> = {
  colorMode: "palette",
  colors: 128,
  autoColors: false,
  smoothing: 1,
  speckle: 3,
  workingSize: 2000,
  upscale: true,
  curveMode: "spline",
  cornerThreshold: 60,
  lengthThreshold: 4,
  spliceThreshold: 45,
  simplify: 0,
  layout: "cutout",
  pathPrecision: 2,
  bwThreshold: 128,
  bwAdaptive: false,
  alphaThreshold: 128,
  layering: "auto",
  maxLayers: 12,
  separateBackground: true,
  groupObjects: true,
  groupGap: 1.5,
  outline: false,
  outlineMode: "line",
  outlineOffset: 1,
  outlineWidth: 0.35,
  outlineColor: "#1a1a1a",
  outlineFillHoles: true,
};

export interface PresetInfo {
  id: PresetId;
  label: string;
  description: string;
  settings: TraceSettings;
}

function preset(id: PresetId, label: string, description: string, overrides: Partial<TraceSettings>): PresetInfo {
  return { id, label, description, settings: { ...BASE, ...overrides, preset: id } };
}

export const PRESETS: readonly PresetInfo[] = [
  preset("photo", "Zdjęcie", "Wierne kolory i detale, 128 barw", {}),
  preset("photo-max", "Zdjęcie · max", "Najwyższa wierność, 256 barw, cięższy plik", {
    colors: 256,
    speckle: 2,
    workingSize: 3000,
  }),
  preset("illustration", "Ilustracja", "Płaskie plamy, paleta dobierana automatycznie", {
    colors: 32,
    autoColors: true,
    speckle: 4,
  }),
  preset("logo", "Logo", "Ostre krawędzie, mało węzłów", {
    colors: 16,
    autoColors: true,
    smoothing: 0,
    speckle: 4,
    workingSize: 2400,
    cornerThreshold: 50,
    simplify: 0.5,
    maxLayers: 16,
  }),
  preset("poster", "Plakat", "6 barw i uproszczone formy", {
    colors: 6,
    smoothing: 3,
    speckle: 12,
    workingSize: 1600,
    cornerThreshold: 90,
    simplify: 1.5,
  }),
  preset("lineart", "Line art", "Czarno-biały rysunek, tusz, pismo", {
    colorMode: "bw",
    smoothing: 1,
    speckle: 4,
    workingSize: 2400,
  }),
  preset("scan", "Skan / szkic", "Czarno-biały, nierówne oświetlenie", {
    colorMode: "bw",
    bwAdaptive: true,
    smoothing: 1,
    speckle: 6,
    workingSize: 2400,
  }),
  preset("pixel", "Pixel art", "Piksele 1:1, bez wygładzania", {
    colors: 32,
    autoColors: true,
    smoothing: 0,
    speckle: 0,
    workingSize: 8000,
    upscale: false,
    curveMode: "pixel",
    layering: "color",
    groupObjects: false,
  }),
];

export const DEFAULT_SETTINGS: TraceSettings = PRESETS[0].settings;

/** Dłuższy bok podglądu roboczego (wektoryzacja „na żywo” podczas przesuwania suwaków). */
export const DRAFT_EDGE = 720;
/** Dłuższy bok miniatur presetów. */
export const THUMBNAIL_EDGE = 256;

/**
 * Ustawienia dla szybkiego podglądu w mniejszej rozdzielczości. Progi w pikselach (plamki,
 * upraszczanie) skalujemy proporcjonalnie, żeby podgląd wyglądał jak wynik końcowy.
 * Zwraca null, gdy obraz roboczy i tak jest mały — wtedy podgląd nic nie przyspiesza.
 */
export function scaledSettings(
  s: TraceSettings,
  sourceWidth: number,
  sourceHeight: number,
  edge: number,
): TraceSettings | null {
  const full = fitWorkingSize(sourceWidth, sourceHeight, s.workingSize, s.upscale);
  const fullEdge = Math.max(full.width, full.height);
  if (fullEdge <= edge * 1.15) return null;
  const ratio = edge / fullEdge;
  return {
    ...s,
    workingSize: Math.max(256, edge),
    upscale: s.upscale && Math.max(sourceWidth, sourceHeight) < edge,
    speckle: Math.round(s.speckle * ratio),
    simplify: Math.round(s.simplify * ratio * 4) / 4,
  };
}

export function getPreset(id: PresetId): PresetInfo {
  const found = PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`Nieznany preset: ${id}`);
  return found;
}

/** Parametry wpływające na geometrię (wymagają ponownego śledzenia). Reszta = tylko warstwy. */
export const TRACE_KEYS = [
  "colorMode",
  "colors",
  "autoColors",
  "smoothing",
  "speckle",
  "workingSize",
  "upscale",
  "curveMode",
  "cornerThreshold",
  "lengthThreshold",
  "spliceThreshold",
  "simplify",
  "layout",
  "pathPrecision",
  "bwThreshold",
  "bwAdaptive",
  "alphaThreshold",
] as const satisfies readonly (keyof TraceSettings)[];

export const LAYER_KEYS = [
  "layering",
  "maxLayers",
  "separateBackground",
  "groupObjects",
  "groupGap",
] as const satisfies readonly (keyof TraceSettings)[];

/** Geometria obrysu całości — liczona osobno, bez ponownej wektoryzacji grafiki. */
export const OUTLINE_KEYS = [
  "outline",
  "outlineOffset",
  "outlineFillHoles",
] as const satisfies readonly (keyof TraceSettings)[];

/** Wygląd obrysu — tylko renderowanie i eksport. */
export const OUTLINE_STYLE_KEYS = [
  "outlineMode",
  "outlineWidth",
  "outlineColor",
] as const satisfies readonly (keyof TraceSettings)[];

export const SETTINGS_KEYS = ["preset", ...TRACE_KEYS, ...LAYER_KEYS, ...OUTLINE_KEYS, ...OUTLINE_STYLE_KEYS] as const;
type SettingsKey = (typeof SETTINGS_KEYS)[number];
// Kompilator pilnuje, by każde pole schematu było sklasyfikowane (śledzenie / warstwy / obrys).
const allKeysClassified: Exclude<keyof TraceSettings, SettingsKey> extends never ? true : false = true;
void allKeysClassified;

/** Pola obrysu są niezależne od presetu — zmiana presetu ich nie nadpisuje. */
export const OUTLINE_FIELDS: ReadonlySet<string> = new Set<string>([...OUTLINE_KEYS, ...OUTLINE_STYLE_KEYS]);

export function outlineFields(
  s: TraceSettings,
): Pick<TraceSettings, (typeof OUTLINE_KEYS)[number] | (typeof OUTLINE_STYLE_KEYS)[number]> {
  return {
    outline: s.outline,
    outlineOffset: s.outlineOffset,
    outlineFillHoles: s.outlineFillHoles,
    outlineMode: s.outlineMode,
    outlineWidth: s.outlineWidth,
    outlineColor: s.outlineColor,
  };
}

export function needsOutline(a: TraceSettings, b: TraceSettings): boolean {
  return OUTLINE_KEYS.some((key) => a[key] !== b[key]);
}

export interface OutlineStyle {
  mode: "line" | "backing";
  color: string;
  /** Grubość w px dokumentu. */
  width: number;
}

/** Styl obrysu w jednostkach dokumentu (procenty → piksele obrazu roboczego). */
export function outlineStyle(
  s: Pick<TraceSettings, "outlineMode" | "outlineColor" | "outlineWidth">,
  docWidth: number,
  docHeight: number,
): OutlineStyle {
  return {
    mode: s.outlineMode,
    color: s.outlineColor,
    width: (s.outlineWidth / 100) * Math.max(docWidth, docHeight),
  };
}

export function changedKeys(a: TraceSettings, b: TraceSettings): SettingsKey[] {
  return SETTINGS_KEYS.filter((key) => a[key] !== b[key]);
}

export function needsRetrace(a: TraceSettings, b: TraceSettings): boolean {
  return TRACE_KEYS.some((key) => a[key] !== b[key]);
}

export function needsRelayer(a: TraceSettings, b: TraceSettings): boolean {
  return LAYER_KEYS.some((key) => a[key] !== b[key]);
}

/** Klucze etapów pipeline — worker trzyma wyniki pośrednie i liczy tylko to, co się zmieniło. */
export function stageKeys(s: TraceSettings) {
  const resize = `${s.workingSize}|${s.upscale}`;
  const prepared = `${resize}|${s.alphaThreshold}|${s.smoothing}`;
  const quantized = s.colorMode === "palette" ? `${prepared}|${s.colors}|${s.autoColors}` : `${prepared}|bw`;
  return { resize, prepared, quantized };
}

/** Opcje silnika VTracer (camelCase, zgodne z `@visioncortex/vtracer`). */
export interface VtracerOptions {
  clustering: "color-cluster" | "bw";
  hierarchical: "stacked" | "cutout";
  mode: "pixel" | "polygon" | "spline";
  filterSpeckle: number;
  colorPrecision: number;
  layerDifference: number;
  cornerThreshold: number;
  lengthThreshold: number;
  maxIterations: number;
  spliceThreshold: number;
  simplify?: number;
  pathPrecision: number;
  palette?: string[];
  optimize: 0 | 1 | 2;
  binaryThreshold?: number;
  adaptive?: boolean;
}

export function toVtracerOptions(s: TraceSettings, palette: readonly string[]): VtracerOptions {
  const base: VtracerOptions = {
    clustering: s.colorMode === "bw" ? "bw" : "color-cluster",
    hierarchical: s.layout,
    mode: s.curveMode,
    filterSpeckle: s.speckle,
    // Obraz jest już skwantowany do palety — pełna precyzja i minimalny krok, żeby silnik nie
    // scalał sąsiednich barw palety; plamki poniżej `speckle` i tak wchłonie, a FixedPalette
    // przyciągnie ich kolor z powrotem do palety.
    colorPrecision: 8,
    layerDifference: 1,
    cornerThreshold: s.cornerThreshold,
    lengthThreshold: s.lengthThreshold,
    maxIterations: 10,
    spliceThreshold: s.spliceThreshold,
    pathPrecision: s.pathPrecision,
    optimize: 1,
  };
  if (s.simplify > 0 && s.curveMode === "spline") base.simplify = s.simplify;
  if (s.colorMode === "bw") {
    base.binaryThreshold = s.bwThreshold;
    if (s.bwAdaptive) base.adaptive = true;
  } else if (palette.length > 0) {
    base.palette = palette.map((hex) => hex.toLowerCase());
  }
  return base;
}

/** Bezpieczny odczyt ustawień z localStorage / wiadomości — niepoprawne pola wracają do domyślnych. */
export function parseSettings(input: unknown): TraceSettings {
  const direct = traceSettingsSchema.safeParse(input);
  if (direct.success) return direct.data;
  if (typeof input !== "object" || input === null) return DEFAULT_SETTINGS;
  const candidate: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, field] of Object.entries(traceSettingsSchema.shape)) {
    const value: unknown = Reflect.get(input, key);
    if (field.safeParse(value).success) candidate[key] = value;
  }
  const merged = traceSettingsSchema.safeParse(candidate);
  return merged.success ? merged.data : DEFAULT_SETTINGS;
}
