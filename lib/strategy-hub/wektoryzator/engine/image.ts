/**
 * Operacje na surowych pikselach RGBA (8 bit, nieprzemnożona alfa — tak jak ImageData).
 * Czyste funkcje bez DOM: działają w Web Workerze i w testach (Node).
 */

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface TargetSize {
  width: number;
  height: number;
  /** Skala względem źródła (>1 = powiększenie). */
  scale: number;
}

/** Twarde limity — ochrona pamięci karty przeglądarki. */
export const MAX_SOURCE_PIXELS = 100_000_000;
export const MAX_WORKING_EDGE = 8000;

export function createImage(width: number, height: number): RgbaImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/**
 * Rozmiar roboczy: dłuższa krawędź = `maxEdge`. Małe obrazy powiększamy tylko gdy `allowUpscale`
 * (gładsze krzywe z „schodkowych” konturów), maksymalnie ×4.
 */
export function fitWorkingSize(width: number, height: number, maxEdge: number, allowUpscale: boolean): TargetSize {
  const longEdge = Math.max(width, height);
  const limit = Math.min(maxEdge, MAX_WORKING_EDGE);
  let scale = limit / longEdge;
  if (scale > 1) scale = allowUpscale ? Math.min(scale, 4) : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { width: w, height: h, scale: w / width };
}

export function hasTransparency(image: RgbaImage): boolean {
  const { data } = image;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/**
 * Binaryzacja kanału alfa: piksele poniżej progu stają się w pełni przezroczyste (silnik ich nie
 * śledzi), pozostałe — w pełni kryjące. Półprzezroczyste krawędzie dostają kolor „zza tła”
 * dzięki odwróceniu przemnożenia, więc nie powstają ciemne obwódki.
 */
export function binarizeAlpha(image: RgbaImage, threshold: number): void {
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < threshold) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    } else {
      data[i + 3] = 255;
    }
  }
}

interface Contribution {
  /** Indeksy pikseli źródłowych. */
  index: Int32Array;
  /** Wagi (sumują się do 1 dla każdego piksela docelowego). */
  weight: Float32Array;
  /** Początek listy wkładów dla piksela docelowego i (offset[i]..offset[i+1]). */
  offset: Int32Array;
}

/** Wagi uśredniania powierzchniowego (filtr pudełkowy z ułamkowym pokryciem) — jakość „area/supersampling”. */
function boxContributions(srcSize: number, dstSize: number): Contribution {
  const ratio = srcSize / dstSize;
  const offsets = new Int32Array(dstSize + 1);
  const idx: number[] = [];
  const wts: number[] = [];
  for (let i = 0; i < dstSize; i++) {
    offsets[i] = idx.length;
    const start = i * ratio;
    const end = start + ratio;
    let s = Math.floor(start);
    for (; s < end && s < srcSize; s++) {
      const coverage = Math.min(s + 1, end) - Math.max(s, start);
      if (coverage > 1e-6) {
        idx.push(s);
        wts.push(coverage / ratio);
      }
    }
  }
  offsets[dstSize] = idx.length;
  return { index: Int32Array.from(idx), weight: Float32Array.from(wts), offset: offsets };
}

function cubicWeight(x: number): number {
  // Catmull-Rom (a = -0.5): ostre, bez przesadnego „dzwonienia”.
  const t = Math.abs(x);
  if (t < 1) return 1.5 * t * t * t - 2.5 * t * t + 1;
  if (t < 2) return -0.5 * t * t * t + 2.5 * t * t - 4 * t + 2;
  return 0;
}

/** Wagi interpolacji dwusześciennej (powiększanie). */
function cubicContributions(srcSize: number, dstSize: number): Contribution {
  const ratio = srcSize / dstSize;
  const offsets = new Int32Array(dstSize + 1);
  const idx: number[] = [];
  const wts: number[] = [];
  for (let i = 0; i < dstSize; i++) {
    offsets[i] = idx.length;
    const center = (i + 0.5) * ratio - 0.5;
    const first = Math.floor(center) - 1;
    let sum = 0;
    const local: Array<[number, number]> = [];
    for (let k = 0; k < 4; k++) {
      const s = first + k;
      const w = cubicWeight(center - s);
      if (w === 0) continue;
      const clamped = Math.min(srcSize - 1, Math.max(0, s));
      local.push([clamped, w]);
      sum += w;
    }
    for (const [s, w] of local) {
      idx.push(s);
      wts.push(w / sum);
    }
  }
  offsets[dstSize] = idx.length;
  return { index: Int32Array.from(idx), weight: Float32Array.from(wts), offset: offsets };
}

/**
 * Skalowanie wysokiej jakości z alfą przemnożoną (bez ciemnych obwódek na krawędziach przezroczystości).
 * Pomniejszanie: uśrednianie powierzchniowe, przetwarzane wierszami (stała, mała pamięć).
 * Powiększanie: Catmull-Rom.
 */
export function resizeImage(src: RgbaImage, width: number, height: number): RgbaImage {
  if (width === src.width && height === src.height) {
    return { width, height, data: new Uint8ClampedArray(src.data) };
  }
  const horiz = width <= src.width ? boxContributions(src.width, width) : cubicContributions(src.width, width);
  const vert = height <= src.height ? boxContributions(src.height, height) : cubicContributions(src.height, height);

  // Wiersze źródłowe przeskalowane w poziomie — liczone leniwie i zapamiętywane w małym buforze kołowym.
  const rowCache = new Map<number, Float32Array>();
  const sd = src.data;
  const sw = src.width;
  const horizontalRow = (y: number): Float32Array => {
    const cached = rowCache.get(y);
    if (cached) return cached;
    const row = new Float32Array(width * 4);
    const base = y * sw * 4;
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let k = horiz.offset[x]; k < horiz.offset[x + 1]; k++) {
        const p = base + horiz.index[k] * 4;
        const w = horiz.weight[k];
        const alpha = sd[p + 3] * w;
        r += sd[p] * alpha;
        g += sd[p + 1] * alpha;
        b += sd[p + 2] * alpha;
        a += alpha;
      }
      const o = x * 4;
      row[o] = r;
      row[o + 1] = g;
      row[o + 2] = b;
      row[o + 3] = a;
    }
    rowCache.set(y, row);
    if (rowCache.size > 8) {
      const oldest = rowCache.keys().next().value;
      if (oldest !== undefined) rowCache.delete(oldest);
    }
    return row;
  };

  const out = createImage(width, height);
  const od = out.data;
  const acc = new Float32Array(width * 4);
  for (let y = 0; y < height; y++) {
    acc.fill(0);
    for (let k = vert.offset[y]; k < vert.offset[y + 1]; k++) {
      const row = horizontalRow(vert.index[k]);
      const w = vert.weight[k];
      for (let i = 0; i < acc.length; i++) acc[i] += row[i] * w;
    }
    const base = y * width * 4;
    for (let x = 0; x < width; x++) {
      const o = x * 4;
      const a = acc[o + 3];
      if (a <= 0.5) {
        od[base + o + 3] = 0;
        continue;
      }
      od[base + o] = acc[o] / a;
      od[base + o + 1] = acc[o + 1] / a;
      od[base + o + 2] = acc[o + 2] / a;
      od[base + o + 3] = a;
    }
  }
  return out;
}

/** Kolory pikseli brzegowych (do wykrywania tła). Pomija piksele przezroczyste. */
export function borderPixels(image: RgbaImage): Uint8ClampedArray {
  const { width: w, height: h, data } = image;
  const out: number[] = [];
  const push = (x: number, y: number) => {
    const p = (y * w + x) * 4;
    if (data[p + 3] === 0) return;
    out.push(data[p], data[p + 1], data[p + 2]);
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    if (h > 1) push(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    push(0, y);
    if (w > 1) push(w - 1, y);
  }
  return Uint8ClampedArray.from(out);
}
