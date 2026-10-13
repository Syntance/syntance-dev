/**
 * Eksport palety: ASE (Adobe Swatch Exchange — Illustrator/Photoshop/InDesign),
 * GPL (GIMP/Inkscape/Krita), CSS custom properties (OKLCH) i JSON.
 */
import { hexToCssOklch, hexToRgb } from "../engine/color";
import type { Swatch, VectorDocument } from "../engine/document";

export type PaletteFormat = "ase" | "gpl" | "css" | "json";

/** Próbki użyte w dokumencie (bez ukrytych), od największego pola. */
export function usedSwatches(doc: VectorDocument): Swatch[] {
  const used = new Set<number>();
  for (const path of doc.paths) if (!path.removed) used.add(path.swatch);
  return doc.swatches.filter((s) => used.has(s.id) && !s.hidden).sort((a, b) => b.area - a.area);
}

function uniqueNames(swatches: readonly Swatch[]): string[] {
  const counts = new Map<string, number>();
  return swatches.map((s) => {
    const n = (counts.get(s.name) ?? 0) + 1;
    counts.set(s.name, n);
    return n === 1 ? s.name : `${s.name} ${n}`;
  });
}

export function buildAse(swatches: readonly Swatch[]): Uint8Array<ArrayBuffer> {
  const names = uniqueNames(swatches);
  const blocks = swatches.map((swatch, i) => {
    const name = `${names[i]} ${swatch.hex}`;
    const nameUnits = [...name].flatMap((ch) => {
      const code = ch.codePointAt(0) ?? 63;
      if (code <= 0xffff) return [code];
      const offset = code - 0x10000;
      return [0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff)];
    });
    const nameLength = nameUnits.length + 1; // + terminator
    const blockLength = 2 + nameLength * 2 + 4 + 12 + 2;
    const block = new DataView(new ArrayBuffer(6 + blockLength));
    let o = 0;
    block.setUint16(o, 0x0001); // wpis koloru
    o += 2;
    block.setUint32(o, blockLength);
    o += 4;
    block.setUint16(o, nameLength);
    o += 2;
    for (const unit of nameUnits) {
      block.setUint16(o, unit);
      o += 2;
    }
    block.setUint16(o, 0);
    o += 2;
    for (const ch of "RGB ") {
      block.setUint8(o, ch.charCodeAt(0));
      o += 1;
    }
    const rgb = hexToRgb(swatch.hex) ?? [0, 0, 0];
    for (const channel of rgb) {
      block.setFloat32(o, channel / 255);
      o += 4;
    }
    block.setUint16(o, 2); // kolor zwykły (nie spot / global)
    return new Uint8Array(block.buffer);
  });
  const header = new DataView(new ArrayBuffer(12));
  "ASEF".split("").forEach((ch, i) => header.setUint8(i, ch.charCodeAt(0)));
  header.setUint16(4, 1);
  header.setUint16(6, 0);
  header.setUint32(8, blocks.length);
  const total = 12 + blocks.reduce((sum, b) => sum + b.length, 0);
  const out = new Uint8Array(total);
  out.set(new Uint8Array(header.buffer), 0);
  let position = 12;
  for (const block of blocks) {
    out.set(block, position);
    position += block.length;
  }
  return out;
}

export function buildGpl(swatches: readonly Swatch[], title: string): string {
  const names = uniqueNames(swatches);
  const lines = ["GIMP Palette", `Name: ${title.replace(/[\r\n]/g, " ")}`, "Columns: 8", "#"];
  swatches.forEach((swatch, i) => {
    const [r, g, b] = hexToRgb(swatch.hex) ?? [0, 0, 0];
    lines.push(
      `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${names[i]} (${swatch.hex})`,
    );
  });
  return lines.join("\n") + "\n";
}

export function buildCss(swatches: readonly Swatch[]): string {
  const names = uniqueNames(swatches);
  const lines = swatches.map(
    (swatch, i) =>
      `  --wektor-${i + 1}: ${hexToCssOklch(swatch.hex)}; /* ${swatch.hex} · ${names[i].replace(/\*\//g, "")} */`,
  );
  return `:root {\n${lines.join("\n")}\n}\n`;
}

export function buildPaletteJson(swatches: readonly Swatch[], totalArea: number): string {
  const names = uniqueNames(swatches);
  return JSON.stringify(
    swatches.map((swatch, i) => ({
      name: names[i],
      hex: swatch.hex,
      oklch: hexToCssOklch(swatch.hex),
      coverage: totalArea > 0 ? Number(((swatch.area / totalArea) * 100).toFixed(2)) : 0,
    })),
    null,
    2,
  );
}
