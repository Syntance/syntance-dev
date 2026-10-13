"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, MousePointerClick, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/strategy-hub/apps/custom-pickers";
import * as edits from "@/lib/strategy-hub/wektoryzator/doc-edits";
import { hexToRgb, normalizeHex, relativeLuminance } from "@/lib/strategy-hub/wektoryzator/engine/color";
import type { Swatch } from "@/lib/strategy-hub/wektoryzator/engine/document";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { formatNumber, Segmented } from "./controls";

type SortMode = "area" | "light" | "hue";

function sortSwatches(swatches: readonly Swatch[], mode: SortMode): Swatch[] {
  const list = [...swatches];
  if (mode === "area") return list.sort((a, b) => b.area - a.area);
  const key = (s: Swatch) => {
    const [r, g, b] = hexToRgb(s.hex) ?? [0, 0, 0];
    if (mode === "light") return -relativeLuminance([r, g, b]);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 1000 + relativeLuminance([r, g, b]);
    let h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
    h *= 60;
    return h < 0 ? h + 360 : h;
  };
  return list.sort((a, b) => key(a) - key(b));
}

function SwatchEditor({ swatch, swatches, total }: { swatch: Swatch; swatches: readonly Swatch[]; total: number }) {
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const doc = useEditor((s) => s.doc);
  const [hexInput, setHexInput] = useState(swatch.hex);
  const [mergeTarget, setMergeTarget] = useState("");
  const [prevHex, setPrevHex] = useState(swatch.hex);
  if (prevHex !== swatch.hex) {
    setPrevHex(swatch.hex);
    setHexInput(swatch.hex);
  }
  const share = total > 0 ? (swatch.area / total) * 100 : 0;
  const others = swatches.filter((s) => s.id !== swatch.id);

  const commitHex = (value: string) => {
    const hex = normalizeHex(value);
    if (hex) apply((d) => edits.setSwatchHex(d, swatch.id, hex), `swatch-${swatch.id}`);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-3">
        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-border">
          <span className="sr-only">Zmień kolor {swatch.name}</span>
          <input
            type="color"
            value={swatch.hex}
            onChange={(e) => commitHex(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span className="block size-full" style={{ backgroundColor: swatch.hex }} />
        </label>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-xs font-semibold">{swatch.name}</p>
          <input
            aria-label="Kolor hex"
            value={hexInput}
            spellCheck={false}
            maxLength={7}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={() => commitHex(hexInput)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitHex(hexInput);
            }}
            className={cn(
              "h-7 w-24 rounded-md border bg-background px-1.5 font-mono text-[11px] uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring",
              normalizeHex(hexInput) ? "border-border" : "border-destructive",
            )}
          />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {share.toLocaleString("pl-PL", { maximumFractionDigits: share < 1 ? 2 : 1 })}%
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => doc && select(doc.paths.filter((p) => !p.removed && p.swatch === swatch.id).map((p) => p.id))}
        >
          <MousePointerClick className="size-3.5" /> Zaznacz kształty
        </Button>
        <Button size="sm" variant="outline" onClick={() => apply((d) => edits.toggleSwatchHidden(d, swatch.id))}>
          {swatch.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {swatch.hidden ? "Pokaż" : "Ukryj"}
        </Button>
        {swatch.hex !== swatch.originalHex ? (
          <Button size="sm" variant="ghost" onClick={() => apply((d) => edits.resetSwatch(d, swatch.id))}>
            <RotateCcw className="size-3.5" /> Przywróć
          </Button>
        ) : null}
      </div>
      {others.length > 0 ? (
        <div className="flex items-end gap-1.5">
          <CustomSelect
            className="min-w-0 flex-1"
            label="Scal z kolorem"
            placeholder="Wybierz kolor…"
            value={mergeTarget}
            onChange={setMergeTarget}
            options={others.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.hex}` }))}
          />
          <Button
            size="sm"
            disabled={mergeTarget === ""}
            onClick={() => {
              apply((d) => edits.mergeSwatch(d, swatch.id, Number(mergeTarget)));
              setMergeTarget("");
            }}
          >
            Scal
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PalettePanel() {
  const doc = useEditor((s) => s.doc);
  const stats = useEditor((s) => s.stats);
  const [sort, setSort] = useState<SortMode>("area");
  const [activeId, setActiveId] = useState<number | null>(null);

  const used = useMemo(() => {
    if (!doc) return [];
    const ids = new Set<number>();
    for (const p of doc.paths) if (!p.removed) ids.add(p.swatch);
    return doc.swatches.filter((s) => ids.has(s.id));
  }, [doc]);
  const sorted = useMemo(() => sortSwatches(used, sort), [used, sort]);
  const total = useMemo(() => used.reduce((sum, s) => sum + s.area, 0), [used]);

  if (!doc) return <p className="p-4 text-xs text-muted-foreground">Paleta pojawi się po wektoryzacji.</p>;
  const active = sorted.find((s) => s.id === activeId) ?? null;

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">{formatNumber(used.length)}</strong> kolorów
          {stats?.paletteError != null ? (
            <span title="95% pikseli różni się od swojego koloru palety o mniej niż ta wartość (ΔE OKLab)">
              {" "}
              · wierność ΔE {stats.paletteError.toLocaleString("pl-PL", { maximumFractionDigits: 3 })}
            </span>
          ) : null}
        </p>
      </div>
      <Segmented
        size="sm"
        label="Sortowanie palety"
        value={sort}
        onChange={setSort}
        options={[
          { value: "area", label: "Pole" },
          { value: "light", label: "Jasność" },
          { value: "hue", label: "Barwa" },
        ]}
      />
      <ul className="grid grid-cols-8 gap-1" aria-label="Paleta kolorów">
        {sorted.map((swatch) => {
          const share = total > 0 ? (swatch.area / total) * 100 : 0;
          return (
            <li key={swatch.id} className="contents">
              <button
                type="button"
                aria-pressed={activeId === swatch.id}
                aria-label={`${swatch.name} ${swatch.hex}, ${share.toFixed(1)}% powierzchni${swatch.hidden ? ", ukryty" : ""}`}
                title={`${swatch.name} · ${swatch.hex} · ${share.toFixed(1)}%`}
                onClick={() => setActiveId(activeId === swatch.id ? null : swatch.id)}
                className={cn(
                  "relative aspect-square rounded-md ring-1 ring-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activeId === swatch.id && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                  swatch.hidden && "opacity-30",
                )}
                style={{ backgroundColor: swatch.hex }}
              >
                {swatch.hex !== swatch.originalHex ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-1 ring-card"
                    aria-hidden
                  />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <SwatchEditor swatch={active} swatches={sorted} total={total} />
      ) : (
        <p className="text-[11px] text-muted-foreground">Kliknij kolor, aby go zmienić, ukryć albo scalić z innym.</p>
      )}
    </div>
  );
}
