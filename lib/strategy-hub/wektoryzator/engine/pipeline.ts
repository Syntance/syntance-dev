/**
 * Pipeline wektoryzacji (czyste funkcje — worker dokłada cache i dekodowanie obrazu):
 *   obraz roboczy → alfa 0/255 → wygładzanie → kwantyzacja OKLab → VTracer → dokument z warstwami.
 */
import { hexToOklab, hexToRgb, type Rgb } from "./color";
import { colorName } from "./color-names";
import type { Swatch, TraceStats, VectorDocument, VectorPath } from "./document";
import { binarizeAlpha, borderPixels, type RgbaImage } from "./image";
import { buildLayers, detectBackgroundSwatches } from "./layering";
import { traceOutline, type OutlineShape } from "./outline";
import { geometryBounds, geometrySignedArea, parsePathData, segmentCount } from "./path-geometry";
import { quantizeImage, type QuantizeResult } from "./quantize";
import { toVtracerOptions, type TraceSettings } from "./settings";
import { smoothImage } from "./smoothing";
import { parseTracedSvg, type RawTrace } from "./svg-output";
import type { Tracer } from "./vtracer";

export type PipelineStage = "decode" | "resize" | "smoothing" | "quantize" | "trace" | "build";

export const STAGE_LABELS: Record<PipelineStage, string> = {
  decode: "Dekodowanie obrazu",
  resize: "Skalowanie",
  smoothing: "Wygładzanie",
  quantize: "Dobór palety",
  trace: "Wektoryzacja",
  build: "Warstwy i grupy",
};

/** Alfa 0/255 + wygładzanie (kopia — wejście zostaje nietknięte). */
export function prepareImage(working: RgbaImage, settings: TraceSettings): RgbaImage {
  const copy: RgbaImage = { width: working.width, height: working.height, data: new Uint8ClampedArray(working.data) };
  binarizeAlpha(copy, settings.alphaThreshold);
  return settings.smoothing > 0 ? smoothImage(copy, settings.smoothing) : copy;
}

export function quantizeStage(prepared: RgbaImage, settings: TraceSettings): QuantizeResult | null {
  if (settings.colorMode !== "palette") return null;
  return quantizeImage(prepared, { colors: settings.colors, auto: settings.autoColors });
}

export function traceStage(
  tracer: Tracer,
  image: RgbaImage,
  settings: TraceSettings,
  palette: readonly string[],
): string {
  const rgba = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength);
  return tracer.trace(rgba, image.width, image.height, toVtracerOptions(settings, palette));
}

export interface BuildContext {
  settings: TraceSettings;
  /** Obraz, który trafił do silnika (do wykrycia tła po krawędziach). */
  tracedImage: RgbaImage;
  sourceWidth: number;
  sourceHeight: number;
  engine: string;
}

/** Dane ścieżki z silnika trafiają do DOM i plików — dopuszczamy wyłącznie składnię path data. */
const PATH_DATA_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\-+\s]+$/;

export function buildDocument(raw: RawTrace, ctx: BuildContext): VectorDocument {
  const { width, height } = raw;
  const edge = 1;

  // Próbki: unikalne kolory wypełnień, posortowane od największego pola.
  const fills = new Map<string, number>();
  const parsed = raw.paths
    .filter((p) => PATH_DATA_RE.test(p.d))
    .map((p, index) => {
      const geometry = parsePathData(p.d);
      const bounds = geometryBounds(geometry);
      const area = Math.abs(geometrySignedArea(geometry));
      fills.set(p.fill, (fills.get(p.fill) ?? 0) + area);
      return { index, d: p.d, fill: p.fill, bounds, area, segments: segmentCount(geometry) };
    });
  const orderedFills = [...fills.entries()].sort((a, b) => b[1] - a[1]);
  const swatchIdByHex = new Map(orderedFills.map(([hex], id) => [hex, id]));
  const swatches: Swatch[] = orderedFills.map(([hex, area], id) => ({
    id,
    hex,
    originalHex: hex,
    area,
    hidden: false,
    name: colorName(hexToOklab(hex)),
  }));

  const paths: VectorPath[] = [];
  for (const p of parsed) {
    if (p.area < 0.01 || p.segments === 0) continue;
    const swatch = swatchIdByHex.get(p.fill);
    if (swatch === undefined) continue;
    const [x0, y0, x1, y1] = p.bounds;
    paths.push({
      id: paths.length,
      d: p.d,
      swatch,
      area: p.area,
      bounds: p.bounds,
      touchesEdge: x0 <= edge || y0 <= edge || x1 >= width - edge || y1 >= height - edge,
      segments: p.segments,
    });
  }

  const backgroundSwatches =
    ctx.settings.colorMode === "palette" ? detectBackgroundSwatches(borderPixels(ctx.tracedImage), swatches) : [];

  const base = {
    width,
    height,
    sourceWidth: ctx.sourceWidth,
    sourceHeight: ctx.sourceHeight,
    layout: ctx.settings.layout,
    colorMode: ctx.settings.colorMode,
    paths,
    swatches,
    backgroundSwatches,
    engine: ctx.engine,
  };
  const layers = buildLayers(base, {
    strategy: ctx.settings.layering,
    maxLayers: ctx.settings.maxLayers,
    separateBackground: ctx.settings.separateBackground,
    groupObjects: ctx.settings.groupObjects,
    groupGap: ctx.settings.groupGap,
  });
  return { ...base, layers };
}

export interface PipelineInput {
  /** Obraz w rozdzielczości roboczej. */
  working: RgbaImage;
  sourceWidth: number;
  sourceHeight: number;
}

export interface PipelineOutput {
  doc: VectorDocument;
  stats: TraceStats;
}

/**
 * Obrys całości liczony z obrazu, który trafił do silnika — tło rozpoznajemy po dokładnych
 * kolorach palety wykrytych na krawędziach (albo po jasności w trybie czarno-białym).
 */
export function computeOutline(
  tracer: Tracer,
  traced: RgbaImage,
  doc: Pick<VectorDocument, "backgroundSwatches" | "swatches">,
  settings: TraceSettings,
): OutlineShape | null {
  if (!settings.outline) return null;
  const backgroundColors: Rgb[] = [];
  for (const id of doc.backgroundSwatches) {
    const rgb = hexToRgb(doc.swatches.find((s) => s.id === id)?.originalHex ?? "");
    if (rgb) backgroundColors.push(rgb);
  }
  const d = traceOutline(tracer, traced, {
    backgroundColors,
    luminanceThreshold: settings.colorMode === "bw" ? settings.bwThreshold : undefined,
    fillHoles: settings.outlineFillHoles,
    offset: (settings.outlineOffset / 100) * Math.max(traced.width, traced.height),
  });
  return d ? { d, visible: true } : null;
}

/** Pełny przebieg bez cache — dla testów i przetwarzania wsadowego. */
export function runPipeline(
  input: PipelineInput,
  settings: TraceSettings,
  tracer: Tracer,
  onStage: (stage: PipelineStage) => void = () => {},
  now: () => number = () => performance.now(),
): PipelineOutput {
  const t0 = now();
  onStage("smoothing");
  const prepared = prepareImage(input.working, settings);
  const t1 = now();
  onStage("quantize");
  const quantized = quantizeStage(prepared, settings);
  const t2 = now();
  onStage("trace");
  const traced = quantized?.image ?? prepared;
  const svg = traceStage(tracer, traced, settings, quantized?.hex ?? []);
  const t3 = now();
  onStage("build");
  const built = buildDocument(parseTracedSvg(svg), {
    settings,
    tracedImage: traced,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    engine: `VTracer ${tracer.version}`,
  });
  const doc = { ...built, outline: computeOutline(tracer, traced, built, settings) };
  const t4 = now();
  return {
    doc,
    stats: collectStats(doc, quantized, {
      smoothing: t1 - t0,
      quantize: t2 - t1,
      trace: t3 - t2,
      build: t4 - t3,
      total: t4 - t0,
    }),
  };
}

export function collectStats(
  doc: VectorDocument,
  quantized: QuantizeResult | null,
  timings: TraceStats["timings"],
): TraceStats {
  let segments = 0;
  for (const p of doc.paths) segments += p.segments;
  return {
    workingWidth: doc.width,
    workingHeight: doc.height,
    paths: doc.paths.length,
    segments,
    colors: doc.swatches.length,
    paletteError: quantized ? quantized.error95 : null,
    timings,
  };
}
