"use client";

import { useId, useState } from "react";
import { normalizeHex } from "@/lib/strategy-hub/wektoryzator/engine/color";
import type { TraceSettings } from "@/lib/strategy-hub/wektoryzator/engine/settings";
import { useEditor } from "@/lib/strategy-hub/wektoryzator/store";
import { cn } from "@/lib/utils";
import { PanelSection, Segmented, SliderField, SwitchField } from "./controls";

const percent = (v: number) => `${v.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setText(value);
  }
  const commit = (raw: string) => {
    const hex = normalizeHex(raw);
    if (hex) onChange(hex);
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs font-medium text-foreground/90">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <span className="relative size-7 overflow-hidden rounded-md ring-1 ring-border">
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => commit(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <span className="block size-full" style={{ backgroundColor: value }} aria-hidden />
        </span>
        <input
          aria-label={`${label} — hex`}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit(text);
          }}
          className={cn(
            "h-7 w-[4.75rem] rounded-md border bg-background px-1.5 font-mono text-[11px] uppercase outline-none focus-visible:ring-2 focus-visible:ring-ring",
            normalizeHex(text) ? "border-border" : "border-destructive",
          )}
        />
      </div>
    </div>
  );
}

/** Obrys całości: jednolity kontur wokół sylwetki — linia (cięcie) albo podkład (np. biała obwódka naklejki). */
export function OutlineSection() {
  const settings = useEditor((s) => s.settings);
  const setSettings = useEditor((s) => s.setSettings);
  const hasOutline = useEditor((s) => Boolean(s.doc?.outline));
  const hasDoc = useEditor((s) => s.doc !== null);
  const update = <K extends keyof TraceSettings>(key: K, value: TraceSettings[K]) => setSettings({ [key]: value });

  return (
    <PanelSection title="Obrys całości">
      <SwitchField
        label="Dodaj obrys całego elementu"
        hint="Jednolity kontur wokół sylwetki — linia cięcia naklejki, kontur dla plotera albo obwódka."
        checked={settings.outline}
        onChange={(v) => update("outline", v)}
      />
      {settings.outline ? (
        <>
          <Segmented
            label="Rodzaj obrysu"
            value={settings.outlineMode}
            onChange={(v) => update("outlineMode", v)}
            options={[
              { value: "line", label: "Linia" },
              { value: "backing", label: "Podkład" },
            ]}
          />
          <SliderField
            label="Odsunięcie od krawędzi"
            value={settings.outlineOffset}
            min={0}
            max={10}
            step={0.1}
            onChange={(v) => update("outlineOffset", v)}
            format={percent}
            hint="Procent dłuższego boku obrazu."
          />
          <SliderField
            label={settings.outlineMode === "line" ? "Grubość linii" : "Zaokrąglenie krawędzi podkładu"}
            value={settings.outlineWidth}
            min={0.05}
            max={4}
            step={0.05}
            onChange={(v) => update("outlineWidth", v)}
            format={percent}
          />
          <ColorField
            label="Kolor obrysu"
            value={settings.outlineColor}
            onChange={(hex) => update("outlineColor", hex)}
          />
          <SwitchField
            label="Tylko kontur zewnętrzny"
            hint="Wypełnia otwory wewnątrz elementu (np. środek litery O)."
            checked={settings.outlineFillHoles}
            onChange={(v) => update("outlineFillHoles", v)}
          />
          {hasDoc && !hasOutline ? <p className="text-[11px] text-muted-foreground">Liczę obrys…</p> : null}
          <p className="text-[11px] leading-snug text-muted-foreground">
            Tło rozpoznaję po przezroczystości albo kolorze przy krawędziach obrazu. Bez wyraźnego tła obrys obejmie
            cały kadr.
          </p>
        </>
      ) : null}
    </PanelSection>
  );
}
