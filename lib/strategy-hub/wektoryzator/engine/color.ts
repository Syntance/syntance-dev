/**
 * Konwersje kolorów: sRGB ↔ liniowe RGB ↔ OKLab / OKLCH (Björn Ottosson, 2020).
 * OKLab jest percepcyjnie równomierny — odległość euklidesowa ≈ odczuwana różnica barw,
 * więc kwantyzacja, porównania i grupowanie warstw liczą się właśnie w nim.
 */

export type Rgb = readonly [r: number, g: number, b: number];
export type Lab = readonly [l: number, a: number, b: number];

export interface Lch {
  l: number;
  c: number;
  /** Kąt barwy w stopniach 0–360 (NaN dla barw achromatycznych nie występuje — wtedy c≈0). */
  h: number;
}

const SRGB_TO_LINEAR = new Float64Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Tablica 4096 kroków: liniowe [0,1] → sRGB 8 bit. Błąd < 0,5 LSB dla ciemnych tonów dzięki gęstej siatce. */
const LINEAR_STEPS = 4096;
const LINEAR_TO_SRGB = new Uint8Array(LINEAR_STEPS + 1);
for (let i = 0; i <= LINEAR_STEPS; i++) {
  const x = i / LINEAR_STEPS;
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  LINEAR_TO_SRGB[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
}

export function srgbToLinear(channel: number): number {
  return SRGB_TO_LINEAR[channel & 255];
}

export function linearToSrgb(x: number): number {
  if (!(x > 0)) return 0;
  if (x >= 1) return 255;
  // Dokładne kodowanie dla bardzo ciemnych wartości (tablica byłaby zbyt zgrubna).
  if (x < 0.01) {
    const v = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    return Math.round(v * 255);
  }
  return LINEAR_TO_SRGB[Math.round(x * LINEAR_STEPS)];
}

/** sRGB (0–255) → OKLab, zapis do bufora (bez alokacji — gorąca ścieżka kwantyzacji). */
export function rgbToOklabInto(
  r: number,
  g: number,
  b: number,
  out: Float32Array | Float64Array,
  offset: number,
): void {
  const lr = SRGB_TO_LINEAR[r & 255];
  const lg = SRGB_TO_LINEAR[g & 255];
  const lb = SRGB_TO_LINEAR[b & 255];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  out[offset] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[offset + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[offset + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}

const scratch = new Float64Array(3);

export function rgbToOklab(rgb: Rgb): Lab {
  rgbToOklabInto(rgb[0], rgb[1], rgb[2], scratch, 0);
  return [scratch[0], scratch[1], scratch[2]];
}

/** OKLab → liniowe RGB (bez przycinania). */
function oklabToLinear(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** OKLab → sRGB 0–255 (przycinane do gamutu). */
export function oklabToRgb(lab: Lab): Rgb {
  const [r, g, b] = oklabToLinear(lab[0], lab[1], lab[2]);
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}

export function oklabToOklch(lab: Lab): Lch {
  const c = Math.hypot(lab[1], lab[2]);
  let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: lab[0], c, h };
}

export function oklchToOklab(lch: Lch): Lab {
  const rad = (lch.h * Math.PI) / 180;
  return [lch.l, lch.c * Math.cos(rad), lch.c * Math.sin(rad)];
}

export function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const HEX_RE = /^#?([0-9a-f]{6})$/i;

export function isHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

export function hexToRgb(hex: string): Rgb | null {
  const match = HEX_RE.exec(hex.trim());
  if (!match) return null;
  const n = Number.parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb: Rgb): string {
  return `#${((1 << 24) | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]).toString(16).slice(1)}`;
}

/** Normalizuje zapis hex do małych liter z `#`. Zwraca null dla niepoprawnych wartości. */
export function normalizeHex(hex: string): string | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHex(rgb) : null;
}

export function hexToOklab(hex: string): Lab {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new Error(`Niepoprawny kolor: ${hex}`);
  return rgbToOklab(rgb);
}

/** Luminancja względna WCAG 2.x (do wyboru koloru tekstu na próbce). */
export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * SRGB_TO_LINEAR[rgb[0]] + 0.7152 * SRGB_TO_LINEAR[rgb[1]] + 0.0722 * SRGB_TO_LINEAR[rgb[2]];
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Zapis CSS `oklch()` — do eksportu palety (CSS custom properties). */
export function hexToCssOklch(hex: string): string {
  const { l, c, h } = oklabToOklch(hexToOklab(hex));
  const hue = c < 0.0005 ? 0 : h;
  return `oklch(${(l * 100).toFixed(2)}% ${c.toFixed(4)} ${hue.toFixed(2)})`;
}
