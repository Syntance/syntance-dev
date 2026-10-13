/**
 * Wspólne typy i przeliczenia eksportu: rozmiar wyjściowy, jednostki, tło, nazwy plików.
 * Dokument trzyma geometrię w pikselach obrazu roboczego — eksport skaluje ją do rozmiaru docelowego.
 */
import { hexToRgb, normalizeHex, type Rgb } from "../engine/color";
import type { VectorDocument } from "../engine/document";
import type { OutlineStyle } from "../engine/settings";

export type SizeUnit = "px" | "mm" | "cm" | "in";

export interface ExportSize {
  width: number;
  height: number;
  unit: SizeUnit;
  /** Rozdzielczość do przeliczeń px ↔ jednostki fizyczne. */
  dpi: number;
}

export interface VectorExportOptions {
  size: ExportSize;
  /** `null` = przezroczyste. */
  background: string | null;
  /** Szerokość obrysu-wypełniacza szczelin w px dokumentu (0 = wyłączony). */
  gapFill: number;
  title: string;
  /** Wygląd obrysu całości; `null`/brak = obrys pominięty (także gdy dokument go nie ma lub jest ukryty). */
  outline?: OutlineStyle | null;
}

export const OUTLINE_LAYER_ID = "obrys";

export interface ExportOutline {
  d: string;
  style: OutlineStyle;
}

/** Obrys do eksportu — tylko gdy istnieje, jest widoczny i podano jego styl. */
export function exportOutline(
  doc: Pick<VectorDocument, "outline">,
  options: Pick<VectorExportOptions, "outline">,
): ExportOutline | null {
  const shape = doc.outline;
  if (!shape || !shape.visible || !options.outline) return null;
  const color = normalizeHex(options.outline.color);
  if (!color) return null;
  return { d: shape.d, style: { ...options.outline, color } };
}

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;

export function toInches(value: number, unit: SizeUnit, dpi: number): number {
  switch (unit) {
    case "in":
      return value;
    case "mm":
      return value / MM_PER_INCH;
    case "cm":
      return (value * 10) / MM_PER_INCH;
    case "px":
      return value / dpi;
  }
}

export function fromInches(inches: number, unit: SizeUnit, dpi: number): number {
  switch (unit) {
    case "in":
      return inches;
    case "mm":
      return inches * MM_PER_INCH;
    case "cm":
      return (inches * MM_PER_INCH) / 10;
    case "px":
      return inches * dpi;
  }
}

export function toPoints(value: number, unit: SizeUnit, dpi: number): number {
  return toInches(value, unit, dpi) * PT_PER_INCH;
}

/** Przeliczenie rozmiaru na inną jednostkę (zachowuje wymiar fizyczny). */
export function convertSize(size: ExportSize, unit: SizeUnit): ExportSize {
  const factor = fromInches(toInches(1, size.unit, size.dpi), unit, size.dpi);
  return { ...size, unit, width: size.width * factor, height: size.height * factor };
}

/** Domyślny rozmiar: oryginalne piksele źródła (proporcje dokumentu). */
export function defaultExportSize(
  doc: Pick<VectorDocument, "sourceWidth" | "sourceHeight" | "width" | "height">,
): ExportSize {
  const width = doc.sourceWidth;
  const height = Math.round((doc.height / doc.width) * width);
  return { width, height, unit: "px", dpi: 300 };
}

/** Wysokość dopasowana do proporcji dokumentu przy zmianie szerokości. */
export function heightForWidth(doc: Pick<VectorDocument, "width" | "height">, width: number): number {
  return (doc.height / doc.width) * width;
}

export function rasterPixels(size: ExportSize): { width: number; height: number } {
  const scale = size.unit === "px" ? 1 : fromInches(toInches(1, size.unit, size.dpi), "px", size.dpi);
  return { width: Math.max(1, Math.round(size.width * scale)), height: Math.max(1, Math.round(size.height * scale)) };
}

export function formatUnit(value: number, unit: SizeUnit): string {
  const decimals = unit === "px" ? 0 : unit === "in" ? 3 : 2;
  const fixed = value.toFixed(decimals);
  const trimmed = decimals > 0 ? fixed.replace(/\.?0+$/, "") : fixed;
  return unit === "px" ? trimmed : `${trimmed}${unit}`;
}

export function backgroundRgb(background: string | null): Rgb | null {
  if (!background) return null;
  const hex = normalizeHex(background);
  return hex ? hexToRgb(hex) : null;
}

/** Liczba z ograniczoną precyzją, bez zbędnych zer (wspólna dla PDF/EPS/DXF). */
export function num(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return "0";
  const fixed = value.toFixed(precision);
  const trimmed = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;
  return trimmed === "-0" ? "0" : trimmed;
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Transliteracja do ASCII (komentarze EPS, warstwy DXF). */
export function toAscii(value: string): string {
  const map: Record<string, string> = {
    ą: "a",
    ć: "c",
    ę: "e",
    ł: "l",
    ń: "n",
    ó: "o",
    ś: "s",
    ź: "z",
    ż: "z",
    Ą: "A",
    Ć: "C",
    Ę: "E",
    Ł: "L",
    Ń: "N",
    Ó: "O",
    Ś: "S",
    Ź: "Z",
    Ż: "Z",
  };
  return value
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => map[ch] ?? ch)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
}

/** Bezpieczna nazwa pliku (Windows/macOS), bez rozszerzenia. */
export function safeFileBase(name: string): string {
  const base = name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return base || "wektor";
}

export function rgb01(rgb: Rgb): [number, number, number] {
  return [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
}
