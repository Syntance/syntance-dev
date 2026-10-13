/**
 * Własny zapis PDF 1.5 (bez zależności): jedna strona, ścieżki jako operatory m/l/c/h + f,
 * warstwy jako Optional Content Groups — Acrobat i przeglądarki PDF pokazują je jako przełączalne
 * warstwy. Strumień treści kompresowany Flate (fflate).
 */
import { zlibSync } from "fflate";
import { hexToRgb } from "../engine/color";
import { swatchById, visibleLayers, type VectorDocument } from "../engine/document";
import { CMD_CLOSE, CMD_CUBIC, CMD_LINE, CMD_MOVE, parsePathData } from "../engine/path-geometry";
import {
  backgroundRgb,
  exportOutline,
  num,
  rgb01,
  toPoints,
  type ExportOutline,
  type VectorExportOptions,
} from "./shared";

/** Tekst PDF jako UTF-16BE z BOM (polskie znaki w nazwach warstw i tytule). */
function pdfText(value: string): string {
  let hex = "FEFF";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 63;
    if (code > 0xffff) {
      const offset = code - 0x10000;
      hex += (0xd800 + (offset >> 10)).toString(16).padStart(4, "0");
      hex += (0xdc00 + (offset & 0x3ff)).toString(16).padStart(4, "0");
    } else {
      hex += code.toString(16).padStart(4, "0");
    }
  }
  return `<${hex.toUpperCase()}>`;
}

function pdfDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `(D:${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z)`;
}

/** Operatory ścieżki PDF ze współrzędnymi dokumentu (transformację robi macierz `cm`). */
export function pathOperators(d: string): string {
  const { cmds, coords } = parsePathData(d);
  const parts: string[] = [];
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
  return parts.join("\n");
}

export interface PdfOptions extends VectorExportOptions {
  compress?: boolean;
  now?: Date;
}

export function buildPdf(doc: VectorDocument, options: PdfOptions): Uint8Array<ArrayBuffer> {
  const compress = options.compress ?? true;
  const pageW = toPoints(options.size.width, options.size.unit, options.size.dpi);
  const pageH = toPoints(options.size.height, options.size.unit, options.size.dpi);
  const sx = pageW / doc.width;
  const sy = pageH / doc.height;
  const swatches = swatchById(doc);
  const layers = visibleLayers(doc);

  // Treść strony.
  const content: string[] = ["q", `${num(sx, 6)} 0 0 ${num(-sy, 6)} 0 ${num(pageH, 4)} cm`, "1 j"];
  const bg = backgroundRgb(options.background);
  if (bg) {
    const [r, g, b] = rgb01(bg);
    content.push(`${num(r)} ${num(g)} ${num(b)} rg`, `0 0 ${doc.width} ${doc.height} re f`);
  }
  if (options.gapFill > 0) content.push(`${num(options.gapFill)} w`);

  // Grupy treści (OCG): podkład obrysu na dole, warstwy, linia obrysu na górze.
  const outline = exportOutline(doc, options);
  const drawOutline = (shape: ExportOutline) => {
    const [r, g, b] = rgb01(hexToRgb(shape.style.color) ?? [0, 0, 0]);
    const color = `${num(r)} ${num(g)} ${num(b)}`;
    content.push("q", `${num(shape.style.width, 3)} w 1 j 1 J`);
    content.push(shape.style.mode === "backing" ? `${color} rg ${color} RG` : `${color} RG`);
    content.push(pathOperators(shape.d));
    content.push(shape.style.mode === "backing" ? "B" : "S", "Q");
  };
  const entries: Array<{ name: string; draw: () => void }> = [];
  if (outline?.style.mode === "backing") entries.push({ name: "Obrys (podkład)", draw: () => drawOutline(outline) });
  for (const view of layers) {
    entries.push({
      name: view.layer.name,
      draw: () => {
        for (const groupView of view.groups) {
          for (const path of groupView.paths) {
            const rgb = hexToRgb(swatches.get(path.swatch)?.hex ?? "#000000") ?? [0, 0, 0];
            const [r, g, b] = rgb01(rgb);
            const color = `${num(r)} ${num(g)} ${num(b)}`;
            content.push(options.gapFill > 0 ? `${color} rg ${color} RG` : `${color} rg`);
            content.push(pathOperators(path.d));
            content.push(options.gapFill > 0 ? "B" : "f");
          }
        }
      },
    });
  }
  if (outline?.style.mode === "line") entries.push({ name: "Obrys", draw: () => drawOutline(outline) });
  entries.forEach((entry, index) => {
    content.push(`/OC /L${index} BDC`);
    entry.draw();
    content.push("EMC");
  });
  content.push("Q");

  const encoder = new TextEncoder();
  const rawContent = encoder.encode(content.join("\n"));
  const streamBytes = compress ? zlibSync(rawContent, { level: 6 }) : rawContent;

  // Numeracja obiektów: 1 katalog, 2 strony, 3 strona, 4 treść, 5 info, 6.. warstwy (OCG).
  const ocgIds = entries.map((_, i) => 6 + i);
  const ocgRefs = ocgIds.map((id) => `${id} 0 R`).join(" ");
  const properties = ocgIds.map((id, i) => `/L${i} ${id} 0 R`).join(" ");

  const objects: Array<string | { dict: string; stream: Uint8Array }> = [];
  objects[1] =
    entries.length > 0
      ? `<< /Type /Catalog /Pages 2 0 R /OCProperties << /OCGs [${ocgRefs}] /D << /Order [${ocgRefs}] /ON [${ocgRefs}] /BaseState /ON >> >> >>`
      : "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = "<< /Type /Pages /Kids [3 0 R] /Count 1 >>";
  objects[3] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageW, 4)} ${num(pageH, 4)}] /Contents 4 0 R /Resources << /Properties << ${properties} >> >> >>`;
  objects[4] = {
    dict: `<< /Length ${streamBytes.length}${compress ? " /Filter /FlateDecode" : ""} >>`,
    stream: streamBytes,
  };
  objects[5] = `<< /Title ${pdfText(options.title)} /Producer ${pdfText(`Wektoryzator · ${doc.engine}`)} /CreationDate ${pdfDate(options.now ?? new Date())} >>`;
  entries.forEach((entry, i) => {
    objects[ocgIds[i]] = `<< /Type /OCG /Name ${pdfText(entry.name)} >>`;
  });

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };
  const pushText = (text: string) => push(encoder.encode(text));

  push(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.5 + binarny komentarz
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    const obj = objects[id];
    offsets[id] = offset;
    if (typeof obj === "string") {
      pushText(`${id} 0 obj\n${obj}\nendobj\n`);
    } else {
      pushText(`${id} 0 obj\n${obj.dict}\nstream\n`);
      push(obj.stream);
      pushText("\nendstream\nendobj\n");
    }
  }
  const xrefOffset = offset;
  const xref = [`xref\n0 ${objects.length}\n`, "0000000000 65535 f \n"];
  for (let id = 1; id < objects.length; id++) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  pushText(xref.join(""));
  pushText(`trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(offset);
  let position = 0;
  for (const chunk of chunks) {
    out.set(chunk, position);
    position += chunk.length;
  }
  return out;
}
