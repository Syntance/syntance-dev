/**
 * Web Worker wektoryzacji: dekodowanie, skalowanie, wygładzanie, kwantyzacja i VTracer poza
 * wątkiem UI. Wyniki etapów są zapamiętywane — zmiana np. samych krzywych pomija skalowanie,
 * wygładzanie i dobór palety.
 */
import { fitWorkingSize, hasTransparency, MAX_SOURCE_PIXELS, resizeImage, type RgbaImage } from "../engine/image";
import type { Swatch } from "../engine/document";
import {
  buildDocument,
  collectStats,
  computeOutline,
  prepareImage,
  quantizeStage,
  traceStage,
  type PipelineStage,
} from "../engine/pipeline";
import type { QuantizeResult } from "../engine/quantize";
import { parseSettings, stageKeys } from "../engine/settings";
import { parseTracedSvg } from "../engine/svg-output";
import { createTracer, type Tracer } from "../engine/vtracer";
import { workerRequestSchema, type WorkerResponse } from "./protocol";

interface Source {
  blob: Blob;
  width: number;
  height: number;
}

interface StageCache {
  resizeKey: string | null;
  working: RgbaImage | null;
  preparedKey: string | null;
  prepared: RgbaImage | null;
  quantizedKey: string | null;
  quantized: QuantizeResult | null;
}

let tracer: Tracer | null = null;
let source: Source | null = null;
let cache: StageCache = emptyCache();
/** Obraz i tło ostatniej wektoryzacji — do szybkiego przeliczania samego obrysu. */
let lastTrace: { traced: RgbaImage; backgroundSwatches: number[]; swatches: Swatch[] } | null = null;

function emptyCache(): StageCache {
  return { resizeKey: null, working: null, preparedKey: null, prepared: null, quantizedKey: null, quantized: null };
}

function post(message: WorkerResponse): void {
  self.postMessage(message);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function init(wasmUrl: string, sha256: string): Promise<void> {
  const response = await fetch(wasmUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Nie udało się pobrać silnika wektoryzacji (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();
  const digest = toHex(await crypto.subtle.digest("SHA-256", bytes));
  if (digest !== sha256) throw new Error("Suma kontrolna silnika się nie zgadza — odśwież stronę.");
  tracer = createTracer(await WebAssembly.compile(bytes));
  post({ type: "ready", version: tracer.version });
}

function readBitmap(bitmap: ImageBitmap): RgbaImage {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Przeglądarka nie udostępnia OffscreenCanvas 2D.");
  context.drawImage(bitmap, 0, 0);
  const image = context.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: image.width, height: image.height, data: image.data };
}

/** Dekodowanie do zadanego rozmiaru — skaler przeglądarki (wysoka jakość), z zapasowym skalerem JS. */
async function decodeAt(blob: Blob, width: number, height: number, original: Source): Promise<RgbaImage> {
  if (width === original.width && height === original.height) {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image", premultiplyAlpha: "none" });
    try {
      return readBitmap(bitmap);
    } finally {
      bitmap.close();
    }
  }
  try {
    const bitmap = await createImageBitmap(blob, {
      imageOrientation: "from-image",
      premultiplyAlpha: "none",
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: "high",
    });
    try {
      return readBitmap(bitmap);
    } finally {
      bitmap.close();
    }
  } catch {
    const full = await createImageBitmap(blob, { imageOrientation: "from-image", premultiplyAlpha: "none" });
    try {
      return resizeImage(readBitmap(full), width, height);
    } finally {
      full.close();
    }
  }
}

async function load(jobId: number, bytes: ArrayBuffer): Promise<void> {
  const blob = new Blob([bytes]);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Nie udało się odczytać obrazu — plik jest uszkodzony albo w nieobsługiwanym formacie.");
  }
  const { width, height } = bitmap;
  bitmap.close();
  if (width * height > MAX_SOURCE_PIXELS) throw new Error("Obraz ma ponad 100 MP — zmniejsz go przed wektoryzacją.");
  source = { blob, width, height };
  cache = emptyCache();
  lastTrace = null;
  const preview = fitWorkingSize(width, height, 256, false);
  const thumbnail = await decodeAt(blob, preview.width, preview.height, source);
  post({ type: "loaded", jobId, width, height, hasAlpha: hasTransparency(thumbnail) });
}

async function trace(jobId: number, settingsInput: unknown): Promise<void> {
  if (!tracer) throw new Error("Silnik nie jest gotowy.");
  if (!source) throw new Error("Najpierw wczytaj obraz.");
  const settings = parseSettings(settingsInput);
  const keys = stageKeys(settings);
  const stage = (name: PipelineStage) => post({ type: "progress", jobId, stage: name });
  const t0 = performance.now();
  const timings = { resize: 0, smoothing: 0, quantize: 0, trace: 0, build: 0, total: 0 };

  if (cache.resizeKey !== keys.resize || !cache.working) {
    stage("resize");
    const t = performance.now();
    const size = fitWorkingSize(source.width, source.height, settings.workingSize, settings.upscale);
    cache = {
      ...emptyCache(),
      resizeKey: keys.resize,
      working: await decodeAt(source.blob, size.width, size.height, source),
    };
    timings.resize = performance.now() - t;
  }
  const working = cache.working;
  if (!working) throw new Error("Brak obrazu roboczego.");

  if (cache.preparedKey !== keys.prepared || !cache.prepared) {
    stage("smoothing");
    const t = performance.now();
    cache = {
      ...cache,
      preparedKey: keys.prepared,
      prepared: prepareImage(working, settings),
      quantizedKey: null,
      quantized: null,
    };
    timings.smoothing = performance.now() - t;
  }
  const prepared = cache.prepared;
  if (!prepared) throw new Error("Brak obrazu po wygładzeniu.");

  if (cache.quantizedKey !== keys.quantized) {
    stage("quantize");
    const t = performance.now();
    cache = { ...cache, quantizedKey: keys.quantized, quantized: quantizeStage(prepared, settings) };
    timings.quantize = performance.now() - t;
  }
  const quantized = cache.quantized;

  stage("trace");
  let t = performance.now();
  const traced = quantized?.image ?? prepared;
  const svg = traceStage(tracer, traced, settings, quantized?.hex ?? []);
  timings.trace = performance.now() - t;

  stage("build");
  t = performance.now();
  const built = buildDocument(parseTracedSvg(svg), {
    settings,
    tracedImage: traced,
    sourceWidth: source.width,
    sourceHeight: source.height,
    engine: `VTracer ${tracer.version}`,
  });
  lastTrace = { traced, backgroundSwatches: built.backgroundSwatches, swatches: built.swatches };
  const doc = { ...built, outline: computeOutline(tracer, traced, built, settings) };
  timings.build = performance.now() - t;
  timings.total = performance.now() - t0;
  post({ type: "result", jobId, doc, stats: collectStats(doc, quantized, timings) });
}

/** Sam obrys całości — z obrazu i tła ostatniej wektoryzacji, bez ponownego śledzenia grafiki. */
function outline(jobId: number, settingsInput: unknown): void {
  if (!tracer) throw new Error("Silnik nie jest gotowy.");
  if (!lastTrace) throw new Error("Najpierw zwektoryzuj obraz.");
  const settings = parseSettings(settingsInput);
  post({ type: "outline", jobId, outline: computeOutline(tracer, lastTrace.traced, lastTrace, settings) });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return `Silnik: ${error}`;
  return "Nieznany błąd wektoryzacji.";
}

// Wiadomości przetwarzane po kolei (async dekodowanie nie może przeplatać się ze śledzeniem).
let queue: Promise<void> = Promise.resolve();

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  const parsed = workerRequestSchema.safeParse(event.data);
  if (!parsed.success) {
    post({ type: "error", jobId: null, message: "Niepoprawne żądanie do silnika." });
    return;
  }
  const request = parsed.data;
  queue = queue.then(async () => {
    try {
      if (request.type === "init") await init(request.wasmUrl, request.sha256);
      else if (request.type === "load") await load(request.jobId, request.bytes);
      else if (request.type === "outline") outline(request.jobId, request.settings);
      else await trace(request.jobId, request.settings);
    } catch (error) {
      post({ type: "error", jobId: request.type === "init" ? null : request.jobId, message: errorMessage(error) });
    }
  });
});
