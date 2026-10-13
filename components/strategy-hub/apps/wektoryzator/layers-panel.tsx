"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Combine,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  MousePointerClick,
  MoreHorizontal,
  Pencil,
  PenTool,
  Trash2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as edits from "@/lib/strategy-hub/wektoryzator/doc-edits";
import type { VectorDocument, VectorLayer } from "@/lib/strategy-hub/wektoryzator/engine/document";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { formatNumber, IconButton } from "./controls";

function layerPathIds(layer: VectorLayer): number[] {
  return layer.groups.flatMap((g) => g.pathIds);
}

function layerSwatchHexes(doc: VectorDocument, layer: VectorLayer, limit = 4): string[] {
  const area = new Map<number, number>();
  for (const id of layerPathIds(layer)) {
    const path = doc.paths[id];
    if (path && !path.removed) area.set(path.swatch, (area.get(path.swatch) ?? 0) + path.area);
  }
  const byId = new Map(doc.swatches.map((s) => [s.id, s.hex]));
  return [...area.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => byId.get(id) ?? "#000000");
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onDone(value);
    else if (event.key === "Escape") onDone(null);
  };
  return (
    <input
      ref={ref}
      aria-label="Nazwa"
      value={value}
      maxLength={80}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onDone(value)}
      className="h-7 min-w-0 flex-1 rounded-md border border-ring bg-background px-1.5 text-xs outline-none"
    />
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  destructive,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5",
        destructive && "text-destructive",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function LayerRow({
  doc,
  layer,
  index,
  count,
}: {
  doc: VectorDocument;
  layer: VectorLayer;
  index: number;
  count: number;
}) {
  const apply = useEditor((s) => s.apply);
  const select = useEditor((s) => s.select);
  const setHoverLayer = useEditor((s) => s.setHoverLayer);
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const ids = layerPathIds(layer);
  const chips = layerSwatchHexes(doc, layer);

  const run = (update: (d: VectorDocument) => edits.DocPatch) => {
    apply(update);
    setMenuOpen(false);
  };

  return (
    <li onMouseEnter={() => setHoverLayer(layer.id)} onMouseLeave={() => setHoverLayer(null)}>
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/60",
          !layer.visible && "opacity-55",
        )}
      >
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Zwiń" : "Rozwiń"} grupy warstwy ${layer.name}`}
          onClick={() => setExpanded((v) => !v)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <IconButton
          label={`${layer.visible ? "Ukryj" : "Pokaż"} warstwę ${layer.name}`}
          active={false}
          className="size-7"
          onClick={() => apply((d) => edits.toggleLayerVisible(d, layer.id))}
        >
          {layer.visible ? <Eye /> : <EyeOff />}
        </IconButton>
        <IconButton
          label={`${layer.locked ? "Odblokuj" : "Zablokuj"} warstwę ${layer.name}`}
          active={layer.locked}
          className="size-7"
          onClick={() => apply((d) => edits.toggleLayerLocked(d, layer.id))}
        >
          {layer.locked ? <Lock /> : <LockOpen />}
        </IconButton>
        <span className="mx-1 flex shrink-0 -space-x-1" aria-hidden>
          {chips.map((hex, i) => (
            <span
              key={`${hex}-${i}`}
              className="size-3.5 rounded-full ring-2 ring-card"
              style={{ backgroundColor: hex }}
            />
          ))}
        </span>
        {renaming ? (
          <RenameInput
            initial={layer.name}
            onDone={(value) => {
              setRenaming(false);
              if (value !== null) apply((d) => edits.renameLayer(d, layer.id, value));
            }}
          />
        ) : (
          <button
            type="button"
            onClick={(event) => {
              if (event.altKey) apply((d) => edits.soloLayer(d, layer.id));
              else select(ids, event.shiftKey ? "add" : "replace");
            }}
            onDoubleClick={() => setRenaming(true)}
            title="Klik — zaznacz kształty · Dwuklik — zmień nazwę · Alt+klik — pokaż tylko tę warstwę"
            className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {layer.name}
          </button>
        )}
        <span className="shrink-0 px-1 font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {formatNumber(ids.length)}
        </span>
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Więcej akcji warstwy ${layer.name}`}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1">
            <MenuItem
              icon={<Pencil />}
              label="Zmień nazwę"
              onClick={() => {
                setMenuOpen(false);
                setRenaming(true);
              }}
            />
            <MenuItem
              icon={<MousePointerClick />}
              label="Zaznacz kształty"
              onClick={() => {
                setMenuOpen(false);
                select(ids);
              }}
            />
            <MenuItem
              icon={<Eye />}
              label="Pokaż tylko tę warstwę"
              onClick={() => run((d) => edits.soloLayer(d, layer.id))}
            />
            <MenuItem
              icon={<ArrowUp />}
              label="Przesuń wyżej"
              disabled={index === count - 1}
              onClick={() => run((d) => edits.moveLayer(d, layer.id, 1))}
            />
            <MenuItem
              icon={<ArrowDown />}
              label="Przesuń niżej"
              disabled={index === 0}
              onClick={() => run((d) => edits.moveLayer(d, layer.id, -1))}
            />
            <MenuItem
              icon={<Combine />}
              label="Scal z warstwą poniżej"
              disabled={index === 0}
              onClick={() => run((d) => edits.mergeLayerDown(d, layer.id))}
            />
            <MenuItem
              icon={<Trash2 />}
              label="Usuń warstwę"
              destructive
              onClick={() => run((d) => edits.deleteLayer(d, layer.id))}
            />
          </PopoverContent>
        </Popover>
      </div>

      {expanded ? (
        <ul className="mb-1 ml-7 border-l border-border pl-2">
          {layer.groups.map((group) => (
            <li
              key={group.id}
              className={cn("group/g flex items-center gap-0.5 rounded-md py-0.5", !group.visible && "opacity-55")}
            >
              <IconButton
                label={`${group.visible ? "Ukryj" : "Pokaż"} grupę ${group.name}`}
                className="size-6 [&_svg]:size-3.5"
                onClick={() => apply((d) => edits.toggleGroupVisible(d, layer.id, group.id))}
              >
                {group.visible ? <Eye /> : <EyeOff />}
              </IconButton>
              {renamingGroup === group.id ? (
                <RenameInput
                  initial={group.name}
                  onDone={(value) => {
                    setRenamingGroup(null);
                    if (value !== null) apply((d) => edits.renameGroup(d, layer.id, group.id, value));
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={(event) => select(group.pathIds, event.shiftKey ? "add" : "replace")}
                  onDoubleClick={() => setRenamingGroup(group.id)}
                  title="Klik — zaznacz · Dwuklik — zmień nazwę"
                  className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {group.name}
                </button>
              )}
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {formatNumber(group.pathIds.length)}
              </span>
              <IconButton
                label={`Usuń grupę ${group.name}`}
                className="size-6 opacity-0 group-hover/g:opacity-100 focus-visible:opacity-100 [&_svg]:size-3.5"
                onClick={() => apply((d) => edits.deleteGroup(d, layer.id, group.id))}
              >
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function OutlineRow() {
  const outline = useEditor((s) => s.doc?.outline ?? null);
  const settings = useEditor((s) => s.settings);
  const toggle = useEditor((s) => s.toggleOutlineVisible);
  if (!outline || !settings.outline) return null;
  const name = settings.outlineMode === "backing" ? "Obrys — podkład" : "Obrys — linia";
  return (
    <li
      className={cn(
        "flex items-center gap-0.5 rounded-lg px-1 py-0.5 hover:bg-muted/60",
        !outline.visible && "opacity-55",
      )}
    >
      <span className="flex size-6 items-center justify-center text-muted-foreground" aria-hidden>
        <PenTool className="size-3.5" />
      </span>
      <IconButton label={`${outline.visible ? "Ukryj" : "Pokaż"} obrys całości`} className="size-7" onClick={toggle}>
        {outline.visible ? <Eye /> : <EyeOff />}
      </IconButton>
      <span className="size-7" aria-hidden />
      <span
        className="mx-1 size-3.5 shrink-0 rounded-full ring-2 ring-card"
        style={{ backgroundColor: settings.outlineColor }}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate px-1 text-xs font-medium">{name}</span>
      <span className="shrink-0 px-1 text-[10.5px] text-muted-foreground">auto</span>
    </li>
  );
}

export function LayersPanel() {
  const doc = useEditor((s) => s.doc);
  const outlineMode = useEditor((s) => s.settings.outlineMode);
  const ordered = useMemo(() => (doc ? [...doc.layers].reverse() : []), [doc]);
  if (!doc) return <p className="p-4 text-xs text-muted-foreground">Warstwy pojawią się po wektoryzacji.</p>;
  if (doc.layers.length === 0) return <p className="p-4 text-xs text-muted-foreground">Brak warstw.</p>;

  return (
    <ul className="space-y-0.5 p-2" aria-label="Warstwy od góry">
      {outlineMode === "line" ? <OutlineRow /> : null}
      {ordered.map((layer) => (
        <LayerRow key={layer.id} doc={doc} layer={layer} index={doc.layers.indexOf(layer)} count={doc.layers.length} />
      ))}
      {outlineMode === "backing" ? <OutlineRow /> : null}
    </ul>
  );
}
