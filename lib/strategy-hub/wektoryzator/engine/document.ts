/**
 * Model dokumentu wektorowego: ścieżki (z silnika) + paleta + warstwy z grupami.
 * Dokument jest niemutowalny — edycje tworzą nowe obiekty (historia cofnij/ponów).
 */
import type { OutlineShape } from "./outline";
import type { Bounds } from "./path-geometry";

export interface VectorPath {
  id: number;
  /** Dane ścieżki SVG prosto z silnika (współrzędne w pikselach obrazu roboczego). */
  d: string;
  swatch: number;
  /** Pole netto w px². */
  area: number;
  bounds: Bounds;
  touchesEdge: boolean;
  segments: number;
  removed?: boolean;
}

export interface Swatch {
  id: number;
  hex: string;
  /** Kolor z wektoryzacji (przed edycją) — do „przywróć kolor”. */
  originalHex: string;
  /** Suma pól ścieżek w tym kolorze (px²). */
  area: number;
  hidden: boolean;
  name: string;
}

export interface VectorGroup {
  id: string;
  name: string;
  visible: boolean;
  pathIds: number[];
}

export type LayerKind = "background" | "color" | "tone" | "hue" | "size" | "all" | "custom";

export interface VectorLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  groups: VectorGroup[];
}

export interface VectorDocument {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  layout: "cutout" | "stacked";
  colorMode: "palette" | "bw";
  paths: VectorPath[];
  swatches: Swatch[];
  /** Kolejność rysowania: od dołu (indeks 0) do góry. */
  layers: VectorLayer[];
  /** Kolory tła wykryte na krawędziach obrazu. */
  backgroundSwatches: number[];
  /** Obrys całości (opcjonalny) — kształt liczony z sylwetki elementu, poza paletą i warstwami. */
  outline?: OutlineShape | null;
  engine: string;
}

export interface StageTimings {
  decode?: number;
  resize?: number;
  smoothing?: number;
  quantize?: number;
  trace?: number;
  build?: number;
  total: number;
}

export interface TraceStats {
  workingWidth: number;
  workingHeight: number;
  paths: number;
  segments: number;
  colors: number;
  /** Błąd palety (95. percentyl ΔE OKLab); null w trybie czarno-białym. */
  paletteError: number | null;
  timings: StageTimings;
}

export function swatchById(doc: VectorDocument): Map<number, Swatch> {
  return new Map(doc.swatches.map((s) => [s.id, s]));
}

/** Ścieżki widoczne w kolejności rysowania (warstwy od dołu, grupy w kolejności). */
export function visiblePaths(doc: VectorDocument): VectorPath[] {
  const swatches = swatchById(doc);
  const out: VectorPath[] = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const group of layer.groups) {
      if (!group.visible) continue;
      for (const id of group.pathIds) {
        const path = doc.paths[id];
        if (!path || path.removed) continue;
        if (swatches.get(path.swatch)?.hidden) continue;
        out.push(path);
      }
    }
  }
  return out;
}

export interface LayerView {
  layer: VectorLayer;
  groups: Array<{ group: VectorGroup; paths: VectorPath[] }>;
}

/** Widoczne warstwy z widocznymi ścieżkami — wspólne źródło dla wszystkich eksporterów. */
export function visibleLayers(doc: VectorDocument): LayerView[] {
  const swatches = swatchById(doc);
  const result: LayerView[] = [];
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    const groups: LayerView["groups"] = [];
    for (const group of layer.groups) {
      if (!group.visible) continue;
      const paths = group.pathIds
        .map((id) => doc.paths[id])
        .filter((p): p is VectorPath => p !== undefined && !p.removed && !swatches.get(p.swatch)?.hidden);
      if (paths.length > 0) groups.push({ group, paths });
    }
    if (groups.length > 0) result.push({ layer, groups });
  }
  return result;
}

export function countSegments(paths: readonly VectorPath[]): number {
  let total = 0;
  for (const p of paths) total += p.segments;
  return total;
}

/** Identyfikatory przyjazne dla Illustratora/Inkscape: ASCII, bez spacji, unikalne. */
export function slugify(name: string): string {
  const map: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };
  const ascii = name
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (ch) => map[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "warstwa";
}

export function uniqueIds(names: readonly string[]): string[] {
  const used = new Map<string, number>();
  return names.map((name) => {
    const base = slugify(name);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
}
