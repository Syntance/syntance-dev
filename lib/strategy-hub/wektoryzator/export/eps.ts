/**
 * Eksport EPS (PostScript Level 2) — dla starszych programów DTP i banków grafik.
 * EPS nie ma warstw: każda warstwa to osobny blok z komentarzem, w kolejności rysowania.
 */
import { hexToRgb } from "../engine/color";
import { swatchById, visibleLayers, type VectorDocument } from "../engine/document";
import { CMD_CLOSE, CMD_CUBIC, CMD_LINE, CMD_MOVE, parsePathData } from "../engine/path-geometry";
import {
  backgroundRgb,
  exportOutline,
  num,
  rgb01,
  toAscii,
  toPoints,
  type ExportOutline,
  type VectorExportOptions,
} from "./shared";

function psPath(d: string): string {
  const { cmds, coords } = parsePathData(d);
  const parts: string[] = ["n"];
  let ci = 0;
  for (const cmd of cmds) {
    if (cmd === CMD_MOVE) {
      parts.push(`${num(coords[ci], 2)} ${num(coords[ci + 1], 2)} m`);
      ci += 2;
    } else if (cmd === CMD_LINE) {
      parts.push(`${num(coords[ci], 2)} ${num(coords[ci + 1], 2)} l`);
      ci += 2;
    } else if (cmd === CMD_CUBIC) {
      parts.push(
        `${num(coords[ci], 2)} ${num(coords[ci + 1], 2)} ${num(coords[ci + 2], 2)} ${num(coords[ci + 3], 2)} ${num(coords[ci + 4], 2)} ${num(coords[ci + 5], 2)} c`,
      );
      ci += 6;
    } else if (cmd === CMD_CLOSE) {
      parts.push("h");
    }
  }
  return parts.join(" ");
}

/** Komentarz DSC: tylko ASCII, bez nawiasów (bezpieczne dla każdego interpretera). */
function dscText(value: string): string {
  return (
    toAscii(value)
      .replace(/[()\\]/g, "")
      .slice(0, 200) || "Wektor"
  );
}

export function buildEps(doc: VectorDocument, options: VectorExportOptions & { now?: Date }): string {
  const pageW = toPoints(options.size.width, options.size.unit, options.size.dpi);
  const pageH = toPoints(options.size.height, options.size.unit, options.size.dpi);
  const sx = pageW / doc.width;
  const sy = pageH / doc.height;
  const swatches = swatchById(doc);
  const now = options.now ?? new Date();

  const out: string[] = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    "%%Creator: Wektoryzator (Syntance)",
    `%%Title: ${dscText(options.title)}`,
    `%%CreationDate: ${now.toISOString()}`,
    `%%BoundingBox: 0 0 ${Math.ceil(pageW)} ${Math.ceil(pageH)}`,
    `%%HiResBoundingBox: 0 0 ${num(pageW, 4)} ${num(pageH, 4)}`,
    "%%LanguageLevel: 2",
    "%%DocumentData: Clean7Bit",
    "%%Pages: 1",
    "%%EndComments",
    "%%BeginProlog",
    "/n {newpath} bind def /m {moveto} bind def /l {lineto} bind def /c {curveto} bind def",
    "/h {closepath} bind def /f {fill} bind def /rg {setrgbcolor} bind def",
    "/B {gsave fill grestore stroke} bind def",
    "%%EndProlog",
    "%%Page: 1 1",
    "gsave",
    `0 ${num(pageH, 4)} translate ${num(sx, 6)} ${num(-sy, 6)} scale`,
    "1 setlinejoin",
  ];
  const bg = backgroundRgb(options.background);
  if (bg) {
    const [r, g, b] = rgb01(bg);
    out.push(
      `${num(r)} ${num(g)} ${num(b)} rg n 0 0 m ${doc.width} 0 l ${doc.width} ${doc.height} l 0 ${doc.height} l h f`,
    );
  }
  const fillOp = options.gapFill > 0 ? "B" : "f";
  const outline = exportOutline(doc, options);
  const drawOutline = (shape: ExportOutline) => {
    const [r, g, b] = rgb01(hexToRgb(shape.style.color) ?? [0, 0, 0]);
    out.push(shape.style.mode === "backing" ? "% Obrys (podklad)" : "% Obrys");
    out.push(
      `gsave ${num(shape.style.width, 3)} setlinewidth 1 setlinecap ${num(r)} ${num(g)} ${num(b)} rg ${psPath(shape.d)} ${shape.style.mode === "backing" ? "B" : "stroke"} grestore`,
    );
  };
  if (outline?.style.mode === "backing") drawOutline(outline);
  if (options.gapFill > 0) out.push(`${num(options.gapFill)} setlinewidth`);
  for (const view of visibleLayers(doc)) {
    out.push(`% Warstwa: ${dscText(view.layer.name)}`);
    for (const groupView of view.groups) {
      for (const path of groupView.paths) {
        const rgb = hexToRgb(swatches.get(path.swatch)?.hex ?? "#000000") ?? [0, 0, 0];
        const [r, g, b] = rgb01(rgb);
        out.push(`${num(r)} ${num(g)} ${num(b)} rg ${psPath(path.d)} ${fillOp}`);
      }
    }
  }
  if (outline?.style.mode === "line") drawOutline(outline);
  out.push("grestore", "showpage", "%%Trailer", "%%EOF", "");
  return out.join("\n");
}
