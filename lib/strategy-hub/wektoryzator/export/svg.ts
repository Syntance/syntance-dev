/**
 * Eksport SVG z warstwami. Warstwy to grupy najwyższego poziomu z atrybutami Inkscape
 * (`inkscape:groupmode="layer"`) — Inkscape i Affinity pokazują je jako warstwy, Illustrator
 * jako nazwane grupy (Release to Layers). Kolory jako atrybuty `fill` — maksymalna zgodność.
 */
import { normalizeHex } from "../engine/color";
import { swatchById, visibleLayers, uniqueIds, type VectorDocument } from "../engine/document";
import {
  exportOutline,
  formatUnit,
  num,
  OUTLINE_LAYER_ID,
  xmlEscape,
  type ExportOutline,
  type VectorExportOptions,
} from "./shared";

export interface SvgBuildOptions extends VectorExportOptions {
  /** Ogranicz do wybranych warstw (eksport warstw osobno); obrys ma id `OUTLINE_LAYER_ID`. */
  layerIds?: ReadonlySet<string>;
  /** Wymiary w pikselach zamiast jednostek fizycznych (rasteryzacja PNG). */
  pixelSize?: { width: number; height: number };
}

function outlineGroup(outline: ExportOutline): string {
  const { d, style } = outline;
  const width = num(style.width, 3);
  const path =
    style.mode === "backing"
      ? `<path fill="${style.color}" stroke="${style.color}" stroke-width="${width}" stroke-linejoin="round" d="${d}"/>`
      : `<path fill="none" stroke="${style.color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" d="${d}"/>`;
  const label = style.mode === "backing" ? "Obrys (podkład)" : "Obrys";
  return `<g id="${OUTLINE_LAYER_ID}" inkscape:groupmode="layer" inkscape:label="${label}">\n${path}\n</g>\n`;
}

export function buildSvg(doc: VectorDocument, options: SvgBuildOptions): string {
  const swatches = swatchById(doc);
  const layers = visibleLayers(doc).filter((view) => !options.layerIds || options.layerIds.has(view.layer.id));
  const layerIds = uniqueIds(layers.map((view) => view.layer.name));
  const outline = !options.layerIds || options.layerIds.has(OUTLINE_LAYER_ID) ? exportOutline(doc, options) : null;
  const width = options.pixelSize ? String(options.pixelSize.width) : formatUnit(options.size.width, options.size.unit);
  const height = options.pixelSize
    ? String(options.pixelSize.height)
    : formatUnit(options.size.height, options.size.unit);
  const gap = options.gapFill > 0 ? options.gapFill : 0;

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" version="1.1" width="${width}" height="${height}" viewBox="0 0 ${doc.width} ${doc.height}">\n`,
  );
  out.push(`<title>${xmlEscape(options.title)}</title>\n`);
  out.push(`<desc>Wektoryzator · ${xmlEscape(doc.engine)}</desc>\n`);
  const background = options.background ? normalizeHex(options.background) : null;
  if (background) {
    out.push(`<rect id="tlo-kolor" width="${doc.width}" height="${doc.height}" fill="${background}"/>\n`);
  }
  // Podkład leży pod grafiką, linia konturu na samej górze.
  if (outline?.style.mode === "backing") out.push(outlineGroup(outline));
  layers.forEach((view, layerIndex) => {
    const layerId = layerIds[layerIndex];
    out.push(`<g id="${layerId}" inkscape:groupmode="layer" inkscape:label="${xmlEscape(view.layer.name)}">\n`);
    const groupIds = uniqueIds(view.groups.map((g) => `${layerId}-${g.group.name}`));
    view.groups.forEach((groupView, groupIndex) => {
      out.push(`<g id="${groupIds[groupIndex]}" inkscape:label="${xmlEscape(groupView.group.name)}">\n`);
      for (const path of groupView.paths) {
        const hex = swatches.get(path.swatch)?.hex ?? "#000000";
        const stroke = gap > 0 ? ` stroke="${hex}" stroke-width="${gap}" stroke-linejoin="round"` : "";
        out.push(`<path fill="${hex}"${stroke} d="${path.d}"/>\n`);
      }
      out.push("</g>\n");
    });
    out.push("</g>\n");
  });
  if (outline?.style.mode === "line") out.push(outlineGroup(outline));
  out.push("</svg>\n");
  return out.join("");
}
