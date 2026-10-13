/**
 * Eksport DXF R12 (AC1009) — najszerzej obsługiwana odmiana: plotery tnące, lasery, CNC, CAD.
 * Krzywe spłaszczane do zamkniętych POLYLINE z zadaną tolerancją; warstwy dokumentu → warstwy DXF,
 * kolor encji = najbliższy kolor indeksowy AutoCAD (ACI).
 */
import { deltaE, hexToRgb, rgbToOklab, type Rgb } from "../engine/color";
import { swatchById, visibleLayers, type VectorDocument } from "../engine/document";
import { flattenGeometry, parsePathData } from "../engine/path-geometry";
import type { OutlineStyle } from "../engine/settings";
import { exportOutline, fromInches, num, toAscii, toInches, type ExportSize } from "./shared";

export type DxfUnit = "mm" | "cm" | "in";

export interface DxfOptions {
  size: ExportSize;
  unit: DxfUnit;
  /** Maksymalne odchylenie łamanej od krzywej, w jednostkach DXF. */
  tolerance: number;
  /** Obrys całości jako osobna warstwa OBRYS (kontur cięcia). */
  outline?: OutlineStyle | null;
  /** Tylko kontur cięcia — bez warstw grafiki. */
  onlyOutline?: boolean;
}

interface DxfShape {
  layer: string;
  aci: number;
  d: string;
}

/** Wspólne przygotowanie: skala, tolerancja i lista kształtów z warstwami/kolorami DXF. */
function dxfPlan(doc: VectorDocument, options: DxfOptions) {
  const widthUnits = fromInches(
    toInches(options.size.width, options.size.unit, options.size.dpi),
    options.unit,
    options.size.dpi,
  );
  const scale = widthUnits / doc.width;
  const swatches = swatchById(doc);
  const used = new Set<string>();
  const layers: Array<{ name: string; color: number }> = [];
  const shapes: DxfShape[] = [];
  const outline = exportOutline(doc, options);

  if (!options.onlyOutline) {
    const swatchAci = new Map<number, number>();
    for (const view of visibleLayers(doc)) {
      // Kolor warstwy = dominujący (największe pole) kolor jej kształtów.
      const areaBySwatch = new Map<number, number>();
      for (const g of view.groups)
        for (const p of g.paths) areaBySwatch.set(p.swatch, (areaBySwatch.get(p.swatch) ?? 0) + p.area);
      const dominant = [...areaBySwatch.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const name = layerName(view.layer.name, used);
      layers.push({ name, color: nearestAci(hexToRgb(swatches.get(dominant ?? -1)?.hex ?? "#000000") ?? [0, 0, 0]) });
      for (const g of view.groups) {
        for (const path of g.paths) {
          let aci = swatchAci.get(path.swatch);
          if (aci === undefined) {
            aci = nearestAci(hexToRgb(swatches.get(path.swatch)?.hex ?? "#000000") ?? [0, 0, 0]);
            swatchAci.set(path.swatch, aci);
          }
          shapes.push({ layer: name, aci, d: path.d });
        }
      }
    }
  }
  if (outline) {
    const name = layerName("Obrys", used);
    const aci = nearestAci(hexToRgb(outline.style.color) ?? [0, 0, 0]);
    layers.push({ name, color: aci });
    shapes.push({ layer: name, aci, d: outline.d });
  }
  return {
    widthUnits,
    scale,
    heightUnits: doc.height * scale,
    toleranceDoc: Math.max(1e-4, options.tolerance / scale),
    layers,
    shapes,
  };
}

/** Podgląd tego, co trafi do DXF: spłaszczone kontury w kolorach ACI (SVG do okna eksportu). */
export function buildDxfPreviewSvg(doc: VectorDocument, options: DxfOptions): string {
  const plan = dxfPlan(doc, options);
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width}" height="${doc.height}">`,
    `<rect width="${doc.width}" height="${doc.height}" fill="#ffffff"/>`,
  ];
  for (const shape of plan.shapes) {
    const [r, g, b] = ACI[shape.aci] ?? [0, 0, 0];
    // Bardzo jasne kolory ACI byłyby niewidoczne na białym podglądzie.
    const stroke = r + g + b > 650 ? "#7a7a7a" : `rgb(${r},${g},${b})`;
    for (const poly of flattenGeometry(parsePathData(shape.d), plan.toleranceDoc)) {
      if (poly.points.length < 6) continue;
      const points = [];
      for (let i = 0; i < poly.points.length; i += 2)
        points.push(`${num(poly.points[i], 2)},${num(poly.points[i + 1], 2)}`);
      out.push(
        `<${poly.closed ? "polygon" : "polyline"} points="${points.join(" ")}" fill="none" stroke="${stroke}" stroke-width="1" vector-effect="non-scaling-stroke"/>`,
      );
    }
  }
  out.push("</svg>");
  return out.join("");
}

/** $INSUNITS: 1 = cale, 4 = mm, 5 = cm. */
const INSUNITS: Record<DxfUnit, number> = { in: 1, mm: 4, cm: 5 };

function hsvToRgb(h: number, s: number, v: number): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Paleta ACI 1–255 (standardowy układ AutoCAD: 24 barwy × 5 jasności × 2 nasycenia + szarości). */
const ACI: Rgb[] = (() => {
  const table: Rgb[] = [];
  const basic: Rgb[] = [
    [0, 0, 0],
    [255, 0, 0],
    [255, 255, 0],
    [0, 255, 0],
    [0, 255, 255],
    [0, 0, 255],
    [255, 0, 255],
    [255, 255, 255],
    [128, 128, 128],
    [192, 192, 192],
  ];
  basic.forEach((rgb, i) => (table[i] = rgb));
  const values = [1, 0.8, 0.6, 0.5, 0.3];
  for (let i = 10; i <= 249; i++) {
    const hue = (Math.floor(i / 10) - 1) * 15;
    const shade = i % 10;
    const v = values[Math.floor(shade / 2)];
    const s = shade % 2 === 0 ? 1 : 0.5;
    table[i] = hsvToRgb(hue, s, v);
  }
  const grays = [51, 80, 105, 130, 190, 255];
  grays.forEach((g, k) => (table[250 + k] = [g, g, g]));
  return table;
})();

const ACI_LAB = ACI.map((rgb) => rgbToOklab(rgb));

export function nearestAci(rgb: Rgb): number {
  const target = rgbToOklab(rgb);
  let best = 7;
  let bestD = Infinity;
  for (let i = 1; i <= 255; i++) {
    // 7 = biel/czerń zależnie od tła CAD — pomijamy, żeby kolor był przewidywalny.
    if (i === 7) continue;
    const d = deltaE(target, ACI_LAB[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function layerName(name: string, used: Set<string>): string {
  const base =
    toAscii(name)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28) || "WARSTWA";
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) candidate = `${base}_${n++}`;
  used.add(candidate);
  return candidate;
}

export function buildDxf(doc: VectorDocument, options: DxfOptions): string {
  const { widthUnits, scale, heightUnits, toleranceDoc, layers, shapes } = dxfPlan(doc, options);

  const out: string[] = [];
  const pair = (code: number, value: string | number) => {
    out.push(String(code), typeof value === "number" ? String(value) : value);
  };

  pair(0, "SECTION");
  pair(2, "HEADER");
  pair(9, "$ACADVER");
  pair(1, "AC1009");
  pair(9, "$INSUNITS");
  pair(70, INSUNITS[options.unit]);
  pair(9, "$EXTMIN");
  pair(10, "0.0");
  pair(20, "0.0");
  pair(9, "$EXTMAX");
  pair(10, num(widthUnits, 4));
  pair(20, num(heightUnits, 4));
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "TABLES");
  pair(0, "TABLE");
  pair(2, "LTYPE");
  pair(70, 1);
  pair(0, "LTYPE");
  pair(2, "CONTINUOUS");
  pair(70, 0);
  pair(3, "Solid line");
  pair(72, 65);
  pair(73, 0);
  pair(40, "0.0");
  pair(0, "ENDTAB");
  pair(0, "TABLE");
  pair(2, "LAYER");
  pair(70, layers.length + 1);
  pair(0, "LAYER");
  pair(2, "0");
  pair(70, 0);
  pair(62, 7);
  pair(6, "CONTINUOUS");
  for (const layer of layers) {
    pair(0, "LAYER");
    pair(2, layer.name);
    pair(70, 0);
    pair(62, layer.color);
    pair(6, "CONTINUOUS");
  }
  pair(0, "ENDTAB");
  pair(0, "ENDSEC");

  pair(0, "SECTION");
  pair(2, "ENTITIES");
  for (const shape of shapes) {
    for (const poly of flattenGeometry(parsePathData(shape.d), toleranceDoc)) {
      if (poly.points.length < 6) continue;
      pair(0, "POLYLINE");
      pair(8, shape.layer);
      pair(62, shape.aci);
      pair(66, 1);
      pair(70, poly.closed ? 1 : 0);
      pair(10, "0.0");
      pair(20, "0.0");
      pair(30, "0.0");
      for (let i = 0; i < poly.points.length; i += 2) {
        pair(0, "VERTEX");
        pair(8, shape.layer);
        pair(10, num(poly.points[i] * scale, 4));
        pair(20, num((doc.height - poly.points[i + 1]) * scale, 4));
        pair(30, "0.0");
      }
      pair(0, "SEQEND");
      pair(8, shape.layer);
    }
  }
  pair(0, "ENDSEC");
  pair(0, "EOF");
  return out.join("\r\n") + "\r\n";
}
