"use client";

import { useMemo, useState } from "react";
import { Layers, Palette, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/strategy-hub/apps/custom-pickers";
import * as edits from "@/lib/strategy-hub/wektoryzator/doc-edits";
import { normalizeHex } from "@/lib/strategy-hub/wektoryzator/engine/color";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { formatNumber } from "./controls";

const NEW_LAYER = "__nowa__";

export function SelectionPanel() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const clearSelection = useEditor((s) => s.clearSelection);
  const deleteSelection = useEditor((s) => s.deleteSelection);
  const [target, setTarget] = useState("");

  const info = useMemo(() => {
    if (!doc || selection.length === 0) return null;
    const swatches = new Map<number, number>();
    let area = 0;
    for (const id of selection) {
      const p = doc.paths[id];
      if (!p) continue;
      area += p.area;
      swatches.set(p.swatch, (swatches.get(p.swatch) ?? 0) + 1);
    }
    const byId = new Map(doc.swatches.map((s) => [s.id, s]));
    const colors = [...swatches.keys()].map((id) => byId.get(id)).filter((s) => s !== undefined);
    return { area, colors, share: (area / (doc.width * doc.height)) * 100 };
  }, [doc, selection]);

  if (!doc || !info) return null;
  const firstHex = info.colors[0]?.hex ?? "#000000";

  return (
    <section aria-label="Zaznaczenie" className="space-y-3 border-t border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs">
          <strong className="font-semibold">{formatNumber(selection.length)}</strong>{" "}
          <span className="text-muted-foreground">
            {selection.length === 1 ? "kształt" : "kształtów"} ·{" "}
            {info.share.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}% pola
          </span>
        </p>
        <button
          type="button"
          onClick={clearSelection}
          aria-label="Odznacz (Esc)"
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="relative flex h-8 cursor-pointer items-center gap-2 rounded-md border border-border px-2 text-xs hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <Palette className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="size-4 rounded ring-1 ring-border" style={{ backgroundColor: firstHex }} aria-hidden />
          Zmień kolor
          <input
            type="color"
            value={firstHex}
            onChange={(e) => {
              const hex = normalizeHex(e.target.value);
              if (hex) apply((d) => edits.recolorPaths(d, selection, hex), "recolor-selection");
            }}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
        </label>
        {info.colors.length === 1 && info.colors[0] ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const swatchId = info.colors[0]?.id;
              select(doc.paths.filter((p) => !p.removed && p.swatch === swatchId).map((p) => p.id));
            }}
          >
            Ten sam kolor
          </Button>
        ) : null}
      </div>

      <div className="flex items-end gap-1.5">
        <CustomSelect
          className="min-w-0 flex-1"
          label="Przenieś do warstwy"
          placeholder="Wybierz warstwę…"
          value={target}
          onChange={setTarget}
          options={[
            ...[...doc.layers].reverse().map((l) => ({ value: l.id, label: l.name })),
            { value: NEW_LAYER, label: "+ Nowa warstwa" },
          ]}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={target === ""}
          onClick={() => {
            apply((d) => edits.movePathsToLayer(d, selection, target === NEW_LAYER ? null : target));
            setTarget("");
          }}
        >
          <Layers className="size-3.5" /> Przenieś
        </Button>
      </div>

      <Button size="sm" variant="destructive" className="w-full" onClick={deleteSelection}>
        <Trash2 className="size-3.5" /> Usuń zaznaczone (Delete)
      </Button>
    </section>
  );
}
