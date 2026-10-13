"use client";

/**
 * Rasteryzacja SVG → PNG w przeglądarce (canvas). SVG budowane z docelowym rozmiarem w pikselach,
 * więc przeglądarka rysuje wektor w pełnej rozdzielczości (bez skalowania bitmapy).
 */

/** Limity canvasa w Chromium/Firefox/Safari — powyżej rysowanie kończy się pustym obrazem. */
export const MAX_RASTER_EDGE = 16_384;
export const MAX_RASTER_PIXELS = 160_000_000;

export function rasterLimitError(width: number, height: number): string | null {
  if (width > MAX_RASTER_EDGE || height > MAX_RASTER_EDGE) {
    return `Maksymalny bok PNG to ${MAX_RASTER_EDGE.toLocaleString("pl-PL")} px.`;
  }
  if (width * height > MAX_RASTER_PIXELS) return "Zbyt duży obraz PNG — zmniejsz rozmiar albo DPI.";
  return null;
}

export async function renderSvgToPng(svg: string, width: number, height: number): Promise<Blob> {
  const limit = rasterLimitError(width, height);
  if (limit) throw new Error(limit);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Przeglądarka nie udostępniła kontekstu 2D.");
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Nie udało się zakodować PNG."))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
