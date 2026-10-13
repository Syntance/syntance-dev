/**
 * Paczki ZIP: każda warstwa jako osobny SVG (na pełnym płótnie — idealne do separacji kolorów,
 * sitodruku, folii) + całość + paleta. Generowane w pamięci (fflate).
 */
import { strToU8, zipSync, type Zippable } from "fflate";
import { visibleLayers, slugify, type VectorDocument } from "../engine/document";
import { buildAse, buildCss, buildGpl, usedSwatches } from "./palette";
import { exportOutline, OUTLINE_LAYER_ID, safeFileBase, type VectorExportOptions } from "./shared";
import { buildSvg } from "./svg";

export function buildLayersZip(doc: VectorDocument, options: VectorExportOptions): Uint8Array<ArrayBuffer> {
  const base = safeFileBase(options.title);
  const files: Zippable = {};
  files[`${base}.svg`] = strToU8(buildSvg(doc, options));
  const views = visibleLayers(doc);
  const pad = String(views.length).length;
  views.forEach((view, index) => {
    const name = `${String(index + 1).padStart(pad, "0")}-${slugify(view.layer.name)}.svg`;
    files[`warstwy/${name}`] = strToU8(
      buildSvg(doc, { ...options, title: `${options.title} · ${view.layer.name}`, layerIds: new Set([view.layer.id]) }),
    );
  });
  if (exportOutline(doc, options)) {
    files[`warstwy/${"0".repeat(pad)}-obrys.svg`] = strToU8(
      buildSvg(doc, { ...options, title: `${options.title} · Obrys`, layerIds: new Set([OUTLINE_LAYER_ID]) }),
    );
  }
  const swatches = usedSwatches(doc);
  files["paleta/paleta.ase"] = buildAse(swatches);
  files["paleta/paleta.gpl"] = strToU8(buildGpl(swatches, options.title));
  files["paleta/paleta.css"] = strToU8(buildCss(swatches));
  // Kopia do bufora ArrayBuffer (fflate typuje wynik jako ArrayBufferLike — Blob wymaga ArrayBuffer).
  return new Uint8Array(zipSync(files, { level: 6 }));
}
