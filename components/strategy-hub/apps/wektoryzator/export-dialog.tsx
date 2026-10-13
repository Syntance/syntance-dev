"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CustomSelect } from "@/components/strategy-hub/apps/custom-pickers";
import { visibleLayers, visiblePaths, type VectorDocument } from "@/lib/strategy-hub/wektoryzator/engine/document";
import { outlineStyle, type OutlineStyle } from "@/lib/strategy-hub/wektoryzator/engine/settings";
import { buildLayersZip } from "@/lib/strategy-hub/wektoryzator/export/bundle";
import {
  buildDxf,
  buildDxfPreviewSvg,
  type DxfOptions,
  type DxfUnit,
} from "@/lib/strategy-hub/wektoryzator/export/dxf";
import { buildEps } from "@/lib/strategy-hub/wektoryzator/export/eps";
import {
  buildAse,
  buildCss,
  buildGpl,
  buildPaletteJson,
  usedSwatches,
  type PaletteFormat,
} from "@/lib/strategy-hub/wektoryzator/export/palette";
import { buildPdf } from "@/lib/strategy-hub/wektoryzator/export/pdf";
import { rasterLimitError, renderSvgToPng } from "@/lib/strategy-hub/wektoryzator/export/raster";
import {
  convertSize,
  defaultExportSize,
  heightForWidth,
  rasterPixels,
  safeFileBase,
  type ExportSize,
  type SizeUnit,
  type VectorExportOptions,
} from "@/lib/strategy-hub/wektoryzator/export/shared";
import { buildSvg } from "@/lib/strategy-hub/wektoryzator/export/svg";
import { saveFile, type SaveFileType } from "@/lib/strategy-hub/wektoryzator/save-file";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { emitToast } from "@/lib/strategy-hub/toast";
import { cn } from "@/lib/utils";
import { formatBytes, formatNumber, plural, Segmented, SliderField, SwitchField } from "./controls";
import styles from "./wektoryzator.module.css";

type Format = "svg" | "pdf" | "eps" | "dxf" | "png" | "zip" | "palette";

const FORMATS: { id: Format; label: string; description: string }[] = [
  { id: "svg", label: "SVG", description: "Edytowalny wektor z warstwami — Illustrator, Inkscape, Figma, Affinity" },
  { id: "pdf", label: "PDF", description: "Druk i Acrobat — warstwy jako przełączalne OCG" },
  { id: "eps", label: "EPS", description: "Starsze programy DTP i banki grafik" },
  { id: "dxf", label: "DXF", description: "Plotery tnące, lasery, CNC — kontury, warstwy CAD" },
  { id: "png", label: "PNG", description: "Bitmapa w dowolnej rozdzielczości, z przezroczystością" },
  { id: "zip", label: "ZIP warstw", description: "Każda warstwa jako osobny SVG + całość + paleta" },
  { id: "palette", label: "Paleta", description: "Kolory do Adobe (ASE), GIMP/Inkscape (GPL), CSS lub JSON" },
];

const FILE_TYPES: Record<Exclude<Format, "palette">, SaveFileType> = {
  svg: { description: "Grafika SVG", mime: "image/svg+xml", extension: "svg" },
  pdf: { description: "Dokument PDF", mime: "application/pdf", extension: "pdf" },
  eps: { description: "Encapsulated PostScript", mime: "application/postscript", extension: "eps" },
  dxf: { description: "Rysunek DXF", mime: "application/dxf", extension: "dxf" },
  png: { description: "Obraz PNG", mime: "image/png", extension: "png" },
  zip: { description: "Archiwum ZIP", mime: "application/zip", extension: "zip" },
};

const PALETTE_TYPES: Record<PaletteFormat, SaveFileType> = {
  ase: { description: "Adobe Swatch Exchange", mime: "application/octet-stream", extension: "ase" },
  gpl: { description: "Paleta GIMP", mime: "text/plain", extension: "gpl" },
  css: { description: "Arkusz CSS", mime: "text/css", extension: "css" },
  json: { description: "JSON", mime: "application/json", extension: "json" },
};

const UNITS: { value: SizeUnit; label: string }[] = [
  { value: "px", label: "px" },
  { value: "mm", label: "mm" },
  { value: "cm", label: "cm" },
  { value: "in", label: "cale" },
];

interface ExportRequest {
  format: Format;
  options: VectorExportOptions;
  dxf: DxfOptions;
  paletteFormat: PaletteFormat;
  pixels: { width: number; height: number };
}

interface BuiltExport {
  /** `null` dla PNG — rasteryzacja dopiero przy zapisie. */
  blob: Blob | null;
  /** SVG pokazywane w podglądzie (identyczne z rysunkiem pliku); `null` dla palety. */
  previewSvg: string | null;
  type: SaveFileType;
}

/** Generuje dokładnie ten plik, który zostanie zapisany (podgląd = pobranie). */
function buildExport(doc: VectorDocument, req: ExportRequest): BuiltExport {
  const { options } = req;
  switch (req.format) {
    case "svg": {
      const svg = buildSvg(doc, options);
      return { blob: new Blob([svg], { type: FILE_TYPES.svg.mime }), previewSvg: svg, type: FILE_TYPES.svg };
    }
    case "pdf":
      return {
        blob: new Blob([buildPdf(doc, options)], { type: FILE_TYPES.pdf.mime }),
        previewSvg: buildSvg(doc, options),
        type: FILE_TYPES.pdf,
      };
    case "eps":
      return {
        blob: new Blob([buildEps(doc, options)], { type: FILE_TYPES.eps.mime }),
        previewSvg: buildSvg(doc, options),
        type: FILE_TYPES.eps,
      };
    case "dxf":
      return {
        blob: new Blob([buildDxf(doc, req.dxf)], { type: FILE_TYPES.dxf.mime }),
        previewSvg: buildDxfPreviewSvg(doc, req.dxf),
        type: FILE_TYPES.dxf,
      };
    case "png":
      return { blob: null, previewSvg: buildSvg(doc, { ...options, pixelSize: req.pixels }), type: FILE_TYPES.png };
    case "zip":
      return {
        blob: new Blob([buildLayersZip(doc, options)], { type: FILE_TYPES.zip.mime }),
        previewSvg: buildSvg(doc, options),
        type: FILE_TYPES.zip,
      };
    case "palette": {
      const swatches = usedSwatches(doc);
      const total = swatches.reduce((sum, s) => sum + s.area, 0);
      const content =
        req.paletteFormat === "ase"
          ? buildAse(swatches)
          : req.paletteFormat === "gpl"
            ? buildGpl(swatches, options.title)
            : req.paletteFormat === "css"
              ? buildCss(swatches)
              : buildPaletteJson(swatches, total);
      const type = PALETTE_TYPES[req.paletteFormat];
      return { blob: new Blob([content], { type: type.mime }), previewSvg: null, type };
    }
  }
}

function SizeFields({
  doc,
  size,
  onChange,
}: {
  doc: VectorDocument;
  size: ExportSize;
  onChange: (size: ExportSize) => void;
}) {
  const decimals = size.unit === "px" ? 0 : 2;
  const round = (v: number) => Number(v.toFixed(decimals));
  const inputClass =
    "h-9 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr] gap-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Szerokość</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={size.unit === "px" ? 1 : 0.1}
            value={round(size.width)}
            onChange={(e) => {
              const width = Number(e.target.value);
              if (width > 0) onChange({ ...size, width, height: heightForWidth(doc, width) });
            }}
            className={inputClass}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Wysokość</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={size.unit === "px" ? 1 : 0.1}
            value={round(size.height)}
            onChange={(e) => {
              const height = Number(e.target.value);
              if (height > 0) onChange({ ...size, height, width: (doc.width / doc.height) * height });
            }}
            className={inputClass}
          />
        </label>
      </div>
      <Segmented
        size="sm"
        label="Jednostka"
        value={size.unit}
        onChange={(unit) => onChange(convertSize(size, unit))}
        options={UNITS}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        DPI
        <input
          type="number"
          min={36}
          max={2400}
          value={size.dpi}
          onChange={(e) => {
            const dpi = Number(e.target.value);
            if (dpi >= 36 && dpi <= 2400) onChange({ ...size, dpi });
          }}
          className="h-7 w-20 rounded-md border border-border bg-background px-2 tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>przelicza piksele na wymiar fizyczny</span>
      </label>
    </div>
  );
}

function PalettePreview({ doc }: { doc: VectorDocument }) {
  const swatches = useMemo(() => usedSwatches(doc), [doc]);
  return (
    <ul className="grid max-h-full grid-cols-2 gap-1.5 overflow-y-auto p-3">
      {swatches.slice(0, 64).map((s) => (
        <li key={s.id} className="flex items-center gap-2 rounded-md bg-card/80 p-1.5">
          <span className="size-6 shrink-0 rounded ring-1 ring-border" style={{ backgroundColor: s.hex }} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-medium">{s.name}</span>
            <span className="block font-mono text-[10px] uppercase text-muted-foreground">{s.hex}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ExportDialog() {
  const open = useEditor((s) => s.exportOpen);
  const setOpen = useEditor((s) => s.setExportOpen);
  const doc = useEditor((s) => s.doc);
  const source = useEditor((s) => s.source);
  const settings = useEditor((s) => s.settings);
  const gapPreview = useEditor((s) => s.view.gapFill);

  const [format, setFormat] = useState<Format>("svg");
  const [size, setSize] = useState<ExportSize | null>(null);
  const [fileName, setFileName] = useState("");
  const [background, setBackground] = useState<"none" | "white">("none");
  const [gapFill, setGapFill] = useState(true);
  const [includeOutline, setIncludeOutline] = useState(true);
  const [onlyOutline, setOnlyOutline] = useState(false);
  const [dxfUnit, setDxfUnit] = useState<DxfUnit>("mm");
  const [dxfTolerance, setDxfTolerance] = useState(0.05);
  const [paletteFormat, setPaletteFormat] = useState<PaletteFormat>("ase");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [built, setBuilt] = useState<{
    key: string;
    doc: VectorDocument;
    result: BuiltExport;
    url: string | null;
    error: string | null;
  } | null>(null);

  // Rozmiar/nazwa inicjalizowane przy otwarciu dla bieżącego dokumentu (wzorzec „poprzedni prop”).
  const [prevKey, setPrevKey] = useState<string | null>(null);
  const openKey = open && doc ? `${doc.width}x${doc.height}|${source?.name ?? ""}` : null;
  if (openKey !== prevKey) {
    setPrevKey(openKey);
    if (openKey && doc) {
      setSize(defaultExportSize(doc));
      setFileName(`${safeFileBase(source?.name ?? "wektor")}-wektor`);
      setGapFill(gapPreview && doc.layout === "cutout");
      setIncludeOutline(Boolean(doc.outline?.visible));
      setOnlyOutline(false);
    }
  }

  const hasOutline = Boolean(doc?.outline?.visible && settings.outline);
  const withOutline = hasOutline && includeOutline;
  const { outlineMode, outlineColor, outlineWidth } = settings;

  const request = useMemo((): ExportRequest | null => {
    if (!doc || !size) return null;
    const title = fileName.trim() || "wektor";
    const outline: OutlineStyle | null = withOutline
      ? outlineStyle({ outlineMode, outlineColor, outlineWidth }, doc.width, doc.height)
      : null;
    const options: VectorExportOptions = {
      size,
      background: background === "white" ? "#ffffff" : null,
      gapFill: gapFill ? 0.6 : 0,
      title,
      outline,
    };
    return {
      format,
      options,
      dxf: { size, unit: dxfUnit, tolerance: dxfTolerance, outline, onlyOutline: onlyOutline && outline !== null },
      paletteFormat,
      pixels: rasterPixels(size),
    };
  }, [
    doc,
    size,
    fileName,
    background,
    gapFill,
    format,
    dxfUnit,
    dxfTolerance,
    paletteFormat,
    onlyOutline,
    withOutline,
    outlineMode,
    outlineColor,
    outlineWidth,
  ]);
  const requestKey = request ? JSON.stringify(request) : "";

  // Podgląd generowany po krótkiej przerwie od ostatniej zmiany opcji (ciężkie formaty nie blokują pisania).
  useEffect(() => {
    if (!open || !doc || !request) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      try {
        const result = buildExport(doc, request);
        if (cancelled) return;
        const url = result.previewSvg
          ? URL.createObjectURL(new Blob([result.previewSvg], { type: "image/svg+xml" }))
          : null;
        setBuilt({ key: requestKey, doc, result, url, error: null });
      } catch (error) {
        if (!cancelled) {
          setBuilt({
            key: requestKey,
            doc,
            result: { blob: null, previewSvg: null, type: FILE_TYPES.svg },
            url: null,
            error: error instanceof Error ? error.message : "Nie udało się przygotować pliku.",
          });
        }
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, doc, request, requestKey]);

  // Zwalnianie poprzednich adresów podglądu.
  useEffect(() => {
    const url = built?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [built]);

  if (!doc || !size || !request) return null;

  // Podgląd jest aktualny tylko dla tych samych opcji i tego samego dokumentu.
  const ready = built !== null && built.key === requestKey && built.doc === doc;
  const pngError = format === "png" ? rasterLimitError(request.pixels.width, request.pixels.height) : null;
  const usesBackground = format !== "dxf" && format !== "palette";
  const layerCount = visibleLayers(doc).length;
  const pathCount = visiblePaths(doc).length;

  const run = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const result = ready && built ? built.result : buildExport(doc, request);
      const base = safeFileBase(request.options.title);
      const blob =
        format === "png"
          ? await renderSvgToPng(
              result.previewSvg ?? buildSvg(doc, { ...request.options, pixelSize: request.pixels }),
              request.pixels.width,
              request.pixels.height,
            )
          : result.blob;
      if (!blob) throw new Error("Nie udało się przygotować pliku.");
      const fileName = `${base}.${result.type.extension}`;
      const saved = await saveFile(blob, fileName, result.type);
      if (saved !== "cancelled") {
        emitToast(`${saved === "saved" ? "Zapisano" : "Pobrano"} ${fileName} (${formatBytes(blob.size)})`, "info");
        setOpen(false);
      }
    } catch (error) {
      emitToast(error instanceof Error ? error.message : "Eksport nie powiódł się.", "error");
    } finally {
      setSaving(false);
    }
  };

  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(buildSvg(doc, request.options));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      emitToast("Przeglądarka zablokowała dostęp do schowka.", "error");
    }
  };

  const sizeInfo = (() => {
    if (!ready || !built) return "Przygotowuję podgląd…";
    if (built.error) return built.error;
    if (format === "png") return `${formatNumber(request.pixels.width)} × ${formatNumber(request.pixels.height)} px`;
    return built.result.blob ? `Rozmiar pliku: ${formatBytes(built.result.blob.size)}` : "";
  })();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Eksportuj wektor</DialogTitle>
          <DialogDescription>
            Zapisane zostanie to, co widzisz w podglądzie: {layerCount}{" "}
            {plural(layerCount, "warstwa", "warstwy", "warstw")}, {formatNumber(pathCount)}{" "}
            {plural(pathCount, "kształt", "kształty", "kształtów")}
            {withOutline ? " + obrys całości" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.25fr)]">
          <div role="radiogroup" aria-label="Format pliku" className="space-y-1">
            {FORMATS.map((f) => {
              const active = f.id === format;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary/60 bg-primary/10" : "border-transparent hover:bg-muted",
                  )}
                >
                  <span className="block text-sm font-semibold">{f.label}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{f.description}</span>
                </button>
              );
            })}
          </div>

          <div className="min-w-0 space-y-5">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Nazwa pliku</span>
              <input
                value={fileName}
                maxLength={80}
                onChange={(e) => setFileName(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            {format !== "palette" ? <SizeFields doc={doc} size={size} onChange={setSize} /> : null}
            {pngError ? <p className="text-xs text-destructive">{pngError}</p> : null}

            {usesBackground ? (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Tło</span>
                <Segmented
                  label="Tło"
                  value={background}
                  onChange={setBackground}
                  options={[
                    { value: "none", label: "Przezroczyste" },
                    { value: "white", label: "Białe" },
                  ]}
                />
              </div>
            ) : null}

            {usesBackground ? (
              <SwitchField
                label="Wypełniacz szczelin"
                hint="Obrys 0,6 px w kolorze kształtu zakrywa jasne rysy na stykach widoczne w części programów."
                checked={gapFill}
                onChange={setGapFill}
              />
            ) : null}

            {hasOutline && format !== "palette" ? (
              <SwitchField
                label="Dołącz obrys całości"
                hint="Osobna warstwa „Obrys” (w DXF: warstwa OBRYS do cięcia)."
                checked={includeOutline}
                onChange={setIncludeOutline}
              />
            ) : null}

            {format === "dxf" ? (
              <div className="space-y-4">
                {hasOutline && includeOutline ? (
                  <SwitchField
                    label="Tylko obrys (kontur cięcia)"
                    hint="Bez warstw grafiki — sam kontur dla plotera tnącego."
                    checked={onlyOutline}
                    onChange={setOnlyOutline}
                  />
                ) : null}
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Jednostki DXF</span>
                  <Segmented
                    label="Jednostki DXF"
                    value={dxfUnit}
                    onChange={setDxfUnit}
                    options={[
                      { value: "mm", label: "mm" },
                      { value: "cm", label: "cm" },
                      { value: "in", label: "cale" },
                    ]}
                  />
                </div>
                <SliderField
                  label="Dokładność krzywych"
                  value={dxfTolerance}
                  min={0.01}
                  max={0.5}
                  step={0.01}
                  onChange={setDxfTolerance}
                  format={(v) => `${v.toLocaleString("pl-PL")} ${dxfUnit === "in" ? "cala" : dxfUnit}`}
                  hint="Maksymalne odchylenie łamanej od krzywej. Mniej = więcej punktów."
                />
              </div>
            ) : null}

            {format === "palette" ? (
              <CustomSelect
                label="Format palety"
                value={paletteFormat}
                onChange={(v) => {
                  if (v === "ase" || v === "gpl" || v === "css" || v === "json") setPaletteFormat(v);
                }}
                options={[
                  { value: "ase", label: "ASE — Illustrator, Photoshop, InDesign" },
                  { value: "gpl", label: "GPL — GIMP, Inkscape, Krita" },
                  { value: "css", label: "CSS — zmienne OKLCH" },
                  { value: "json", label: "JSON — nazwa, hex, OKLCH, pokrycie" },
                ]}
              />
            ) : null}
          </div>

          <section aria-label="Podgląd pliku" className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Podgląd pliku</h3>
              <span
                className={cn("text-[11px] tabular-nums", built?.error ? "text-destructive" : "text-muted-foreground")}
              >
                {sizeInfo}
              </span>
            </div>
            <div
              className={cn(
                "relative flex min-h-64 flex-1 items-center justify-center overflow-hidden rounded-lg border border-border",
                styles.checker,
              )}
              style={{ aspectRatio: format === "palette" ? undefined : `${doc.width} / ${doc.height}` }}
            >
              {format === "palette" ? (
                <PalettePreview doc={doc} />
              ) : ready && built?.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- podgląd lokalnego pliku (blob URL)
                <img
                  src={built.url}
                  alt={`Podgląd pliku ${format.toUpperCase()}`}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              )}
            </div>
            {format === "dxf" ? (
              <p className="text-[11px] text-muted-foreground">DXF zawiera same kontury — tak zobaczy je ploter.</p>
            ) : null}
          </section>
        </div>

        <DialogFooter>
          {format === "svg" ? (
            <Button variant="outline" onClick={() => void copySvg()} disabled={saving}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Skopiowano" : "Kopiuj SVG"}
            </Button>
          ) : null}
          <Button onClick={() => void run()} disabled={saving || pngError !== null}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {saving ? "Generuję…" : `Zapisz ${FORMATS.find((f) => f.id === format)?.label ?? ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
