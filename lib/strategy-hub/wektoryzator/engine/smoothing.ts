/**
 * Wygładzanie z zachowaniem krawędzi (filtr bilateralny w OKLab).
 * Usuwa szum matrycy i artefakty JPEG, nie rozmywając konturów — dzięki temu wektor ma mniej
 * „okruchów”, a krawędzie obiektów zostają ostre.
 */
import { linearToSrgb, rgbToOklabInto } from "./color";
import type { RgbaImage } from "./image";

export interface SmoothingPreset {
  radius: number;
  /** Tolerancja różnicy barw w OKLab — powyżej niej sąsiad prawie się nie liczy (krawędź). */
  sigmaColor: number;
  passes: number;
}

/** Poziomy suwaka „Wygładzanie” (0 = wyłączone). */
export const SMOOTHING_LEVELS: readonly (SmoothingPreset | null)[] = [
  null,
  { radius: 1, sigmaColor: 0.035, passes: 1 },
  { radius: 2, sigmaColor: 0.05, passes: 1 },
  { radius: 2, sigmaColor: 0.065, passes: 2 },
  { radius: 3, sigmaColor: 0.08, passes: 2 },
  { radius: 4, sigmaColor: 0.1, passes: 2 },
];

const RANGE_LUT_SIZE = 2048;

function oklabToRgbInto(L: number, a: number, b: number, out: Uint8ClampedArray, offset: number): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  out[offset] = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  out[offset + 1] = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  out[offset + 2] = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}

function bilateralPass(
  lab: Float32Array,
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  preset: SmoothingPreset,
): Float32Array {
  const { radius, sigmaColor } = preset;
  const out = new Float32Array(lab.length);
  const sigmaSpace = Math.max(0.8, radius / 1.5);
  const offsets: number[] = [];
  const spatial: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius + radius) continue;
      offsets.push(dx, dy);
      spatial.push(Math.exp(-(dx * dx + dy * dy) / (2 * sigmaSpace * sigmaSpace)));
    }
  }
  // Waga zakresowa z tablicy: exp(-d² / 2σ²), d² ∈ [0, maxD2].
  const maxD2 = (sigmaColor * 4) ** 2;
  const lutScale = (RANGE_LUT_SIZE - 1) / maxD2;
  const rangeLut = new Float32Array(RANGE_LUT_SIZE);
  for (let i = 0; i < RANGE_LUT_SIZE; i++) {
    rangeLut[i] = Math.exp(-(i / lutScale) / (2 * sigmaColor * sigmaColor));
  }
  const taps = spatial.length;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const i3 = i * 3;
      if (alpha[i * 4 + 3] === 0) continue;
      const L0 = lab[i3];
      const a0 = lab[i3 + 1];
      const b0 = lab[i3 + 2];
      let sL = 0;
      let sa = 0;
      let sb = 0;
      let sw = 0;
      for (let t = 0; t < taps; t++) {
        const xx = x + offsets[t * 2];
        const yy = y + offsets[t * 2 + 1];
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const j = yy * width + xx;
        if (alpha[j * 4 + 3] === 0) continue;
        const j3 = j * 3;
        const dL = lab[j3] - L0;
        const da = lab[j3 + 1] - a0;
        const db = lab[j3 + 2] - b0;
        const d2 = dL * dL + da * da + db * db;
        if (d2 >= maxD2) continue;
        const w = spatial[t] * rangeLut[(d2 * lutScale) | 0];
        sL += w * lab[j3];
        sa += w * lab[j3 + 1];
        sb += w * lab[j3 + 2];
        sw += w;
      }
      out[i3] = sL / sw;
      out[i3 + 1] = sa / sw;
      out[i3 + 2] = sb / sw;
    }
  }
  return out;
}

/** Zwraca nowy obraz po wygładzeniu (poziom 0 → kopia bez zmian). */
export function smoothImage(image: RgbaImage, level: number): RgbaImage {
  const preset = SMOOTHING_LEVELS[Math.max(0, Math.min(SMOOTHING_LEVELS.length - 1, Math.round(level)))];
  const out: RgbaImage = { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
  if (!preset) return out;

  const { width, height, data } = image;
  const count = width * height;
  let lab: Float32Array = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    rgbToOklabInto(data[p], data[p + 1], data[p + 2], lab, i * 3);
  }
  for (let pass = 0; pass < preset.passes; pass++) {
    lab = bilateralPass(lab, data, width, height, preset);
  }
  const od = out.data;
  for (let i = 0; i < count; i++) {
    const p = i * 4;
    if (data[p + 3] === 0) continue;
    oklabToRgbInto(lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2], od, p);
  }
  return out;
}
