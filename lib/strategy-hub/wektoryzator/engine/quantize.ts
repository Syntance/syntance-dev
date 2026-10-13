/**
 * Kwantyzacja kolorów: k-means++ w przestrzeni OKLab na histogramie 6-bitowym.
 *
 * Histogram (64³ kubełków, średni kolor każdego kubełka) redukuje miliony pikseli do zwykle
 * kilkudziesięciu tysięcy punktów — k-means liczy się wtedy w ułamku sekundy nawet dla 256 kolorów.
 * Wagi ~liczność^0.7 dają szansę małym, ale ważnym detalom (oczy, logotypy), których czysta
 * liczność by „zjadła”.
 */
import { oklabToRgb, rgbToHex, rgbToOklabInto, type Lab, type Rgb } from "./color";
import type { RgbaImage } from "./image";

export interface QuantizeOptions {
  /** Docelowa (lub maksymalna przy `auto`) liczba kolorów, 2–256. */
  colors: number;
  /** Automatycznie dobierz najmniejszą liczbę kolorów, która wiernie oddaje obraz. */
  auto: boolean;
  /** Wykładnik wagi kubełka (1 = czysta liczność). */
  detailWeight?: number;
  seed?: number;
}

export interface QuantizeResult {
  palette: Rgb[];
  paletteLab: Lab[];
  hex: string[];
  /** Indeks koloru palety dla każdego piksela; 0xffff = piksel przezroczysty. */
  labels: Uint16Array;
  /** Obraz po kwantyzacji (dokładnie kolory palety, alfa 0/255). */
  image: RgbaImage;
  /** 95. percentyl błędu ΔE (OKLab) ważony liczbą pikseli. */
  error95: number;
}

export const TRANSPARENT_LABEL = 0xffff;

interface Histogram {
  /** Punkty OKLab (3 × n). */
  points: Float64Array;
  /** Wagi do k-means. */
  weights: Float64Array;
  /** Liczba pikseli w kubełku (do statystyk błędu). */
  counts: Float64Array;
  /** Klucz kubełka → indeks punktu. */
  keyToIndex: Int32Array;
}

const BUCKETS = 1 << 18; // 6 bitów × 3 kanały

function bucketKey(r: number, g: number, b: number): number {
  return ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
}

function buildHistogram(image: RgbaImage, detailWeight: number): Histogram {
  const { data } = image;
  const sums = new Float64Array(BUCKETS * 3);
  const counts = new Uint32Array(BUCKETS);
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] === 0) continue;
    const key = bucketKey(data[p], data[p + 1], data[p + 2]);
    sums[key * 3] += data[p];
    sums[key * 3 + 1] += data[p + 1];
    sums[key * 3 + 2] += data[p + 2];
    counts[key]++;
  }
  let n = 0;
  for (let k = 0; k < BUCKETS; k++) if (counts[k] > 0) n++;
  const points = new Float64Array(n * 3);
  const weights = new Float64Array(n);
  const countsOut = new Float64Array(n);
  const keyToIndex = new Int32Array(BUCKETS).fill(-1);
  let i = 0;
  for (let k = 0; k < BUCKETS; k++) {
    const c = counts[k];
    if (c === 0) continue;
    rgbToOklabInto(
      Math.round(sums[k * 3] / c),
      Math.round(sums[k * 3 + 1] / c),
      Math.round(sums[k * 3 + 2] / c),
      points,
      i * 3,
    );
    weights[i] = c ** detailWeight;
    countsOut[i] = c;
    keyToIndex[k] = i;
    i++;
  }
  return { points, weights, counts: countsOut, keyToIndex };
}

/** Deterministyczny generator (LCG) — ta sama paleta przy każdym uruchomieniu. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function nearest(points: Float64Array, i: number, centers: Float64Array, k: number): number {
  const L = points[i * 3];
  const a = points[i * 3 + 1];
  const b = points[i * 3 + 2];
  let best = 0;
  let bestD = Infinity;
  for (let c = 0; c < k; c++) {
    const dL = L - centers[c * 3];
    const da = a - centers[c * 3 + 1];
    const db = b - centers[c * 3 + 2];
    const d = dL * dL + da * da + db * db;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

interface KMeansResult {
  centers: Float64Array;
  k: number;
  assignment: Int32Array;
}

function kmeans(hist: Histogram, requested: number, seed: number): KMeansResult {
  const { points, weights } = hist;
  const n = weights.length;
  const k = Math.max(1, Math.min(requested, n));
  const centers = new Float64Array(k * 3);
  const random = createRandom(seed);

  // k-means++: pierwszy środek = najcięższy kubełek, kolejne losowane proporcjonalnie do w·D².
  let first = 0;
  for (let i = 1; i < n; i++) if (weights[i] > weights[first]) first = i;
  centers.set(points.subarray(first * 3, first * 3 + 3), 0);
  const dist = new Float64Array(n).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let total = 0;
    const pc = (c - 1) * 3;
    for (let i = 0; i < n; i++) {
      const dL = points[i * 3] - centers[pc];
      const da = points[i * 3 + 1] - centers[pc + 1];
      const db = points[i * 3 + 2] - centers[pc + 2];
      const d = dL * dL + da * da + db * db;
      if (d < dist[i]) dist[i] = d;
      total += dist[i] * weights[i];
    }
    let pick = n - 1;
    if (total > 0) {
      let r = random() * total;
      for (let i = 0; i < n; i++) {
        r -= dist[i] * weights[i];
        if (r <= 0) {
          pick = i;
          break;
        }
      }
    }
    centers.set(points.subarray(pick * 3, pick * 3 + 3), c * 3);
  }

  // Lloyd.
  const assignment = new Int32Array(n).fill(-1);
  const acc = new Float64Array(k * 4);
  for (let iter = 0; iter < 40; iter++) {
    acc.fill(0);
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const c = nearest(points, i, centers, k);
      if (assignment[i] !== c) {
        moved++;
        assignment[i] = c;
      }
      const w = weights[i];
      acc[c * 4] += points[i * 3] * w;
      acc[c * 4 + 1] += points[i * 3 + 1] * w;
      acc[c * 4 + 2] += points[i * 3 + 2] * w;
      acc[c * 4 + 3] += w;
    }
    for (let c = 0; c < k; c++) {
      const w = acc[c * 4 + 3];
      if (w > 0) {
        centers[c * 3] = acc[c * 4] / w;
        centers[c * 3 + 1] = acc[c * 4 + 1] / w;
        centers[c * 3 + 2] = acc[c * 4 + 2] / w;
      }
    }
    if (moved <= n * 0.0005) break;
  }
  return { centers, k, assignment };
}

/** Zamienia środki na kolory sRGB, usuwa duplikaty po zaokrągleniu i puste klastry. */
function finalizePalette(hist: Histogram, result: KMeansResult): { palette: Rgb[]; lab: Lab[] } {
  const used = new Float64Array(result.k);
  for (let i = 0; i < result.assignment.length; i++) used[result.assignment[i]] += hist.counts[i];
  const seen = new Map<string, number>();
  const palette: Rgb[] = [];
  for (let c = 0; c < result.k; c++) {
    if (used[c] === 0) continue;
    const rgb = oklabToRgb([result.centers[c * 3], result.centers[c * 3 + 1], result.centers[c * 3 + 2]]);
    const key = rgbToHex(rgb);
    if (seen.has(key)) continue;
    seen.set(key, palette.length);
    palette.push(rgb);
  }
  const scratch = new Float64Array(3);
  const lab = palette.map((rgb): Lab => {
    rgbToOklabInto(rgb[0], rgb[1], rgb[2], scratch, 0);
    return [scratch[0], scratch[1], scratch[2]];
  });
  return { palette, lab };
}

/** Przypisanie kubełków do palety (po zaokrągleniu kolorów) + 95. percentyl błędu. */
function assignBuckets(hist: Histogram, lab: Lab[]): { bucketLabel: Int32Array; error95: number } {
  const n = hist.weights.length;
  const centers = new Float64Array(lab.length * 3);
  lab.forEach((c, i) => centers.set(c, i * 3));
  const bucketLabel = new Int32Array(n);
  // Percentyl ważony liczbą pikseli liczony z histogramu błędów (O(n), bez sortowania).
  const BINS = 1000;
  const MAX_ERROR = 0.5;
  const errorHistogram = new Float64Array(BINS);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const c = nearest(hist.points, i, centers, lab.length);
    bucketLabel[i] = c;
    const error = Math.hypot(
      hist.points[i * 3] - centers[c * 3],
      hist.points[i * 3 + 1] - centers[c * 3 + 1],
      hist.points[i * 3 + 2] - centers[c * 3 + 2],
    );
    errorHistogram[Math.min(BINS - 1, Math.floor((error / MAX_ERROR) * BINS))] += hist.counts[i];
    total += hist.counts[i];
  }
  let acc = 0;
  let error95 = MAX_ERROR;
  for (let bin = 0; bin < BINS; bin++) {
    acc += errorHistogram[bin];
    if (acc >= total * 0.95) {
      error95 = ((bin + 1) / BINS) * MAX_ERROR;
      break;
    }
  }
  return { bucketLabel, error95 };
}

/** Kolejne liczby kolorów sprawdzane w trybie automatycznym. */
const AUTO_STEPS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128, 160, 192, 256];

/** Próg „wiernej” palety: 95% pikseli różni się od swojego koloru o mniej niż ~JND. */
const AUTO_ERROR_TARGET = 0.045;

export function quantizeImage(image: RgbaImage, options: QuantizeOptions): QuantizeResult {
  const maxColors = Math.max(2, Math.min(256, Math.round(options.colors)));
  const seed = options.seed ?? 0x5eed;
  const hist = buildHistogram(image, options.detailWeight ?? 0.7);
  const n = hist.weights.length;

  let chosen: { palette: Rgb[]; lab: Lab[] } | null = null;
  let assignment: { bucketLabel: Int32Array; error95: number } | null = null;

  if (n === 0) {
    chosen = { palette: [], lab: [] };
    assignment = { bucketLabel: new Int32Array(0), error95: 0 };
  } else if (options.auto) {
    for (const k of AUTO_STEPS) {
      if (k > maxColors) break;
      const candidate = finalizePalette(hist, kmeans(hist, k, seed));
      const evaluated = assignBuckets(hist, candidate.lab);
      chosen = candidate;
      assignment = evaluated;
      if (evaluated.error95 <= AUTO_ERROR_TARGET || candidate.palette.length >= n) break;
    }
    if (!chosen || !assignment) {
      chosen = finalizePalette(hist, kmeans(hist, maxColors, seed));
      assignment = assignBuckets(hist, chosen.lab);
    }
  } else {
    chosen = finalizePalette(hist, kmeans(hist, maxColors, seed));
    assignment = assignBuckets(hist, chosen.lab);
  }

  const { palette, lab } = chosen;
  const { bucketLabel, error95 } = assignment;
  const { width, height, data } = image;
  const labels = new Uint16Array(width * height);
  const out: RgbaImage = { width, height, data: new Uint8ClampedArray(data.length) };
  const od = out.data;
  for (let i = 0, p = 0; i < labels.length; i++, p += 4) {
    if (data[p + 3] === 0) {
      labels[i] = TRANSPARENT_LABEL;
      continue;
    }
    const label = bucketLabel[hist.keyToIndex[bucketKey(data[p], data[p + 1], data[p + 2])]];
    labels[i] = label;
    const color = palette[label];
    od[p] = color[0];
    od[p + 1] = color[1];
    od[p + 2] = color[2];
    od[p + 3] = 255;
  }

  return { palette, paletteLab: lab, hex: palette.map(rgbToHex), labels, image: out, error95 };
}
