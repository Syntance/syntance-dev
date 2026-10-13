/**
 * Obrys całości: jednolity kontur wokół całego elementu (sylwetka bez tła), opcjonalnie odsunięty
 * od krawędzi — kontur cięcia naklejki, linia dla plotera albo podkład pod grafiką.
 *
 * Kroki: maska sylwetki (tło = przezroczystość albo kolor tła połączony z krawędzią obrazu)
 * → wypełnienie otworów → odsunięcie przez transformatę odległości (dokładna EDT, Felzenszwalb)
 * → wektoryzacja maski VTracerem z mocnym wygładzaniem.
 */
import type { Rgb } from "./color";
import type { RgbaImage } from "./image";
import { parseTracedSvg } from "./svg-output";
import type { Tracer } from "./vtracer";

export interface OutlineShape {
  /** Kontur (może mieć kilka podścieżek — osobne wyspy). Współrzędne obrazu roboczego. */
  d: string;
  visible: boolean;
}

export interface MaskOptions {
  /** Kolory tła (dokładne kolory palety) — piksele w tych kolorach połączone z krawędzią to tło. */
  backgroundColors: readonly Rgb[];
  /** Tryb czarno-biały: tło to piksele jaśniejsze niż próg. */
  luminanceThreshold?: number;
  fillHoles: boolean;
}

/** Maska sylwetki: 1 = element, 0 = tło. */
export function silhouetteMask(image: RgbaImage, options: MaskOptions): Uint8Array {
  const { width, height, data } = image;
  const count = width * height;
  const candidate = new Uint8Array(count); // 1 = może być tłem
  const bg = options.backgroundColors;
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    if (data[p + 3] === 0) {
      candidate[i] = 1;
      continue;
    }
    if (options.luminanceThreshold !== undefined) {
      const luma = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      if (luma >= options.luminanceThreshold) candidate[i] = 1;
      continue;
    }
    for (const [r, g, b] of bg) {
      if (data[p] === r && data[p + 1] === g && data[p + 2] === b) {
        candidate[i] = 1;
        break;
      }
    }
  }

  const mask = new Uint8Array(count);
  if (!options.fillHoles) {
    for (let i = 0; i < count; i++) mask[i] = candidate[i] ? 0 : 1;
    return mask;
  }

  // Tło = kandydaci połączeni z krawędzią obrazu (flood fill). Reszta (z otworami) = element.
  const reached = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0;
  let tail = 0;
  const push = (i: number) => {
    if (candidate[i] && !reached[i]) {
      reached[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (i >= width) push(i - width);
    if (i < count - width) push(i + width);
  }
  for (let i = 0; i < count; i++) mask[i] = reached[i] ? 0 : 1;
  return mask;
}

const INF = 1e20;

/** 1D kwadrat odległości (Felzenszwalb & Huttenlocher 2012). */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    const dq = q - v[k];
    d[q] = dq * dq + f[v[k]];
  }
}

/** Rozszerzenie maski o promień (euklidesowo — okrągłe narożniki odsunięcia). */
export function dilateMask(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const grid = new Float64Array(width * height);
  for (let i = 0; i < grid.length; i++) grid[i] = mask[i] ? 0 : INF;
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const v = new Int32Array(size);
  const z = new Float64Array(size + 1);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) f[y] = grid[y * width + x];
    edt1d(f, height, d, v, z);
    for (let y = 0; y < height; y++) grid[y * width + x] = d[y];
  }
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) f[x] = grid[row + x];
    edt1d(f, width, d, v, z);
    for (let x = 0; x < width; x++) grid[row + x] = d[x];
  }
  const r2 = radius * radius;
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = grid[i] <= r2 ? 1 : 0;
  return out;
}

export interface OutlineOptions extends MaskOptions {
  /** Odsunięcie od krawędzi elementu w px obrazu roboczego. */
  offset: number;
}

/** Kontur całości jako dane ścieżki SVG; null, gdy maska jest pusta. */
export function traceOutline(tracer: Tracer, image: RgbaImage, options: OutlineOptions): string | null {
  const { width, height } = image;
  const mask = dilateMask(silhouetteMask(image, options), width, height, options.offset);
  let filled = 0;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    filled++;
    rgba[i * 4 + 3] = 255; // czarny, kryjący; tło przezroczyste (silnik je pomija)
  }
  if (filled === 0) return null;
  const longEdge = Math.max(width, height);
  const svg = tracer.trace(rgba, width, height, {
    clustering: "color-cluster",
    hierarchical: "cutout",
    mode: "spline",
    filterSpeckle: Math.max(2, Math.round(longEdge * 0.004)),
    colorPrecision: 8,
    layerDifference: 1,
    cornerThreshold: 120,
    lengthThreshold: 6,
    maxIterations: 10,
    spliceThreshold: 45,
    simplify: Math.max(0.75, longEdge / 1600),
    pathPrecision: 2,
    palette: ["#000000"],
    optimize: 1,
  });
  const paths = parseTracedSvg(svg).paths.filter((p) => p.fill === "#000000");
  return paths.length > 0 ? paths.map((p) => p.d).join(" ") : null;
}
