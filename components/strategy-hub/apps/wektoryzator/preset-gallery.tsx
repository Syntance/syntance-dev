"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { outlineFields, PRESETS, type TraceSettings } from "@/lib/strategy-hub/wektoryzator/engine/settings";
import type { VectorDocument } from "@/lib/strategy-hub/wektoryzator/engine/document";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { IconButton, PanelSection } from "./controls";
import { DocThumbnail } from "./vector-stage";
import styles from "./wektoryzator.module.css";

function Thumbnail({ doc, show }: { doc: VectorDocument | undefined; show: boolean }) {
  if (!show) return null;
  return (
    <span className={cn("mb-1.5 block aspect-[16/10] w-full overflow-hidden rounded-md", styles.checker)}>
      {doc ? (
        <DocThumbnail doc={doc} className="size-full" />
      ) : (
        <span className="block size-full animate-pulse bg-muted/60" aria-hidden />
      )}
    </span>
  );
}

function NameInput({
  initial,
  onDone,
  placeholder,
}: {
  initial: string;
  onDone: (value: string | null) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") onDone(value.trim() ? value : null);
    else if (event.key === "Escape") onDone(null);
  };
  return (
    <input
      ref={ref}
      aria-label="Nazwa presetu"
      placeholder={placeholder}
      value={value}
      maxLength={40}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => onDone(value.trim() ? value : null)}
      className="h-8 min-w-0 flex-1 rounded-md border border-ring bg-background px-2 text-xs outline-none"
    />
  );
}

/**
 * Presety z podglądem: miniatury bieżącego obrazu w każdym stylu, najechanie (lub fokus) pokazuje
 * podgląd na płótnie bez stosowania, kliknięcie stosuje. Własne presety: zapis, nazwa, nadpisanie, usunięcie.
 */
export function PresetGallery() {
  const settings = useEditor((s) => s.settings);
  const hasImage = useEditor((s) => s.source !== null);
  const hasDoc = useEditor((s) => s.doc !== null);
  const thumbs = useEditor((s) => s.presetThumbs);
  const userPresets = useEditor((s) => s.userPresets);
  const activeUserPresetId = useEditor((s) => s.activeUserPresetId);
  const applyPreset = useEditor((s) => s.applyPreset);
  const applyUserPreset = useEditor((s) => s.applyUserPreset);
  const previewPreset = useEditor((s) => s.previewPreset);
  const saveUserPreset = useEditor((s) => s.saveUserPreset);
  const updateUserPreset = useEditor((s) => s.updateUserPreset);
  const renameUserPreset = useEditor((s) => s.renameUserPreset);
  const deleteUserPreset = useEditor((s) => s.deleteUserPreset);
  const [saving, setSaving] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const hoverProps = (presetSettings: TraceSettings, label: string, active: boolean) =>
    hasDoc && !active
      ? {
          onPointerEnter: () => previewPreset({ ...presetSettings, ...outlineFields(settings) }, label),
          onPointerLeave: () => previewPreset(null),
          onFocus: () => previewPreset({ ...presetSettings, ...outlineFields(settings) }, label),
          onBlur: () => previewPreset(null),
        }
      : {};

  return (
    <>
      <PanelSection
        title="Preset"
        aside={hasDoc ? <span className="text-[10.5px] text-muted-foreground">najedź = podgląd</span> : undefined}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map((preset) => {
            const active = settings.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  previewPreset(null);
                  applyPreset(preset.id);
                }}
                {...hoverProps(preset.settings, preset.label, active)}
                className={cn(
                  "rounded-lg border p-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary/60 bg-primary/10"
                    : "border-border bg-background/40 hover:border-primary/30 hover:bg-muted/50",
                )}
              >
                <Thumbnail doc={thumbs[preset.id]} show={hasImage} />
                <span className="block px-1 text-xs font-semibold">{preset.label}</span>
                <span className="mt-0.5 block px-1 text-[10.5px] leading-snug text-muted-foreground">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
        {settings.preset === "custom" && activeUserPresetId === null ? (
          <p className="text-[11px] text-muted-foreground">Własne ustawienia — możesz je zapisać jako preset.</p>
        ) : null}
      </PanelSection>

      <PanelSection
        title="Moje presety"
        aside={
          !saving ? (
            <button
              type="button"
              onClick={() => setSaving(true)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" /> Zapisz bieżące
            </button>
          ) : undefined
        }
      >
        {saving ? (
          <div className="flex gap-1.5">
            <NameInput
              initial=""
              placeholder="Nazwa, np. Naklejki 6 kolorów"
              onDone={(value) => {
                setSaving(false);
                if (value) saveUserPreset(value);
              }}
            />
          </div>
        ) : null}
        {userPresets.length === 0 && !saving ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Ustaw suwaki tak, jak lubisz, i zapisz jako własny preset — wróci jednym kliknięciem przy następnym obrazie.
          </p>
        ) : null}
        <ul className="space-y-1.5">
          {userPresets.map((preset) => {
            const active = activeUserPresetId === preset.id;
            return (
              <li
                key={preset.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg border p-1.5 transition-colors",
                  active ? "border-primary/60 bg-primary/10" : "border-border bg-background/40 hover:bg-muted/50",
                )}
              >
                {renaming === preset.id ? (
                  <NameInput
                    initial={preset.name}
                    onDone={(value) => {
                      setRenaming(null);
                      if (value) renameUserPreset(preset.id, value);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      previewPreset(null);
                      applyUserPreset(preset.id);
                    }}
                    {...hoverProps(preset.settings, preset.name, active)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {hasImage ? (
                      <span className={cn("block h-9 w-14 shrink-0 overflow-hidden rounded", styles.checker)}>
                        {thumbs[preset.id] ? (
                          <DocThumbnail doc={thumbs[preset.id]} className="size-full" />
                        ) : (
                          <span className="block size-full animate-pulse bg-muted/60" aria-hidden />
                        )}
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate text-xs font-medium">{preset.name}</span>
                  </button>
                )}
                <div className="flex shrink-0 items-center opacity-70 group-hover:opacity-100 group-focus-within:opacity-100">
                  <IconButton
                    label={`Nadpisz „${preset.name}” bieżącymi ustawieniami`}
                    className="size-7 [&_svg]:size-3.5"
                    onClick={() => {
                      updateUserPreset(preset.id);
                      setSavedFlash(preset.id);
                      window.setTimeout(() => setSavedFlash(null), 1400);
                    }}
                  >
                    {savedFlash === preset.id ? <Check /> : <Save />}
                  </IconButton>
                  <IconButton
                    label={`Zmień nazwę „${preset.name}”`}
                    className="size-7 [&_svg]:size-3.5"
                    onClick={() => setRenaming(preset.id)}
                  >
                    <Pencil />
                  </IconButton>
                  <IconButton
                    label={`Usuń preset „${preset.name}”`}
                    className="size-7 hover:text-destructive [&_svg]:size-3.5"
                    onClick={() => deleteUserPreset(preset.id)}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      </PanelSection>
    </>
  );
}
