"use client";

import { Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/strategy-hub/apps/custom-pickers";
import {
  LAYERING_STRATEGIES,
  type LayeringStrategy,
  type TraceSettings,
} from "@/lib/strategy-hub/wektoryzator/engine/settings";
import { useEditor, useNeedsRetrace } from "@/lib/strategy-hub/wektoryzator/store";
import { PanelSection, Segmented, SliderField, SwitchField } from "./controls";
import { OutlineSection } from "./outline-section";
import { PresetGallery } from "./preset-gallery";

const WORKING_SIZES = [1000, 1500, 2000, 2500, 3000, 4000, 6000, 8000];

export const LAYERING_LABELS: Record<LayeringStrategy, string> = {
  auto: "Automatycznie (tło + kolory)",
  color: "Każdy kolor osobno",
  tone: "Według jasności",
  hue: "Według barwy",
  size: "Według wielkości",
  single: "Jedna warstwa",
};

const degrees = (v: number) => `${v}°`;
const px = (v: number) => `${v} px`;

export function SettingsPanel() {
  const settings = useEditor((s) => s.settings);
  const setSettings = useEditor((s) => s.setSettings);
  const applyPreset = useEditor((s) => s.applyPreset);
  const autoTrace = useEditor((s) => s.autoTrace);
  const setAutoTrace = useEditor((s) => s.setAutoTrace);
  const retrace = useEditor((s) => s.retrace);
  const status = useEditor((s) => s.status);
  const hasDoc = useEditor((s) => s.doc !== null);
  const needsRetrace = useNeedsRetrace();
  const update = <K extends keyof TraceSettings>(key: K, value: TraceSettings[K]) => setSettings({ [key]: value });
  const palette = settings.colorMode === "palette";
  const busy = status === "tracing" || status === "loading";

  return (
    <aside
      aria-label="Ustawienia wektoryzacji"
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <PresetGallery />

        <PanelSection title="Kolory">
          <Segmented
            label="Tryb kolorów"
            value={settings.colorMode}
            onChange={(v) => update("colorMode", v)}
            options={[
              { value: "palette", label: "Kolorowy" },
              { value: "bw", label: "Czarno-biały" },
            ]}
          />
          {palette ? (
            <>
              <SliderField
                label={settings.autoColors ? "Maksymalnie kolorów" : "Liczba kolorów"}
                value={settings.colors}
                min={2}
                max={256}
                onChange={(v) => update("colors", v)}
              />
              <SwitchField
                label="Dobierz liczbę kolorów automatycznie"
                hint="Najmniejsza paleta, która wiernie oddaje obraz — idealne do logo."
                checked={settings.autoColors}
                onChange={(v) => update("autoColors", v)}
              />
            </>
          ) : (
            <>
              <SliderField
                label="Próg czerni"
                value={settings.bwThreshold}
                min={1}
                max={254}
                onChange={(v) => update("bwThreshold", v)}
                disabled={settings.bwAdaptive}
              />
              <SwitchField
                label="Próg adaptacyjny"
                hint="Dla skanów i zdjęć kartki z nierównym oświetleniem."
                checked={settings.bwAdaptive}
                onChange={(v) => update("bwAdaptive", v)}
              />
            </>
          )}
        </PanelSection>

        <PanelSection title="Szczegóły">
          <SliderField
            label="Wygładzanie zdjęcia"
            value={settings.smoothing}
            min={0}
            max={5}
            onChange={(v) => update("smoothing", v)}
            format={(v) => (v === 0 ? "wył." : String(v))}
            hint="Usuwa szum i artefakty JPEG, zachowując krawędzie."
          />
          <SliderField
            label="Pomiń drobiazgi mniejsze niż"
            value={settings.speckle}
            min={0}
            max={64}
            onChange={(v) => update("speckle", v)}
            format={px}
          />
          <CustomSelect
            label="Rozdzielczość robocza (dłuższy bok)"
            value={String(settings.workingSize)}
            onChange={(v) => update("workingSize", Number(v))}
            options={WORKING_SIZES.map((size) => ({
              value: String(size),
              label: `${size.toLocaleString("pl-PL")} px`,
            }))}
          />
          <SwitchField
            label="Powiększaj małe obrazy"
            hint="Gładsze krzywe z obrazów o niskiej rozdzielczości."
            checked={settings.upscale}
            onChange={(v) => update("upscale", v)}
          />
        </PanelSection>

        <PanelSection title="Krzywe">
          <Segmented
            label="Rodzaj ścieżek"
            value={settings.curveMode}
            onChange={(v) => update("curveMode", v)}
            options={[
              { value: "spline", label: "Krzywe" },
              { value: "polygon", label: "Wielokąty" },
              { value: "pixel", label: "Piksele" },
            ]}
          />
          {settings.curveMode === "spline" ? (
            <>
              <SliderField
                label="Próg narożnika"
                value={settings.cornerThreshold}
                min={0}
                max={180}
                onChange={(v) => update("cornerThreshold", v)}
                format={degrees}
                hint="Mniej = więcej ostrych narożników; więcej = gładsze łuki."
              />
              <SliderField
                label="Upraszczanie krzywych"
                value={settings.simplify}
                min={0}
                max={4}
                step={0.25}
                onChange={(v) => update("simplify", v)}
                format={(v) => (v === 0 ? "wył." : `${v.toLocaleString("pl-PL")} px`)}
                hint="Mniej węzłów przy zachowanym kształcie."
              />
              <SliderField
                label="Minimalny segment"
                value={settings.lengthThreshold}
                min={3.5}
                max={10}
                step={0.5}
                onChange={(v) => update("lengthThreshold", v)}
                format={(v) => `${v.toLocaleString("pl-PL")} px`}
              />
              <SliderField
                label="Łączenie krzywych"
                value={settings.spliceThreshold}
                min={0}
                max={180}
                onChange={(v) => update("spliceThreshold", v)}
                format={degrees}
              />
            </>
          ) : null}
          <SliderField
            label="Precyzja współrzędnych"
            value={settings.pathPrecision}
            min={0}
            max={3}
            onChange={(v) => update("pathPrecision", v)}
            format={(v) => `${v} miejsc`}
          />
        </PanelSection>

        <PanelSection title="Układ kształtów">
          <Segmented
            label="Układ kształtów"
            value={settings.layout}
            onChange={(v) => update("layout", v)}
            options={[
              { value: "cutout", label: "Mozaika" },
              { value: "stacked", label: "Stos" },
            ]}
          />
          <p className="text-[11px] leading-snug text-muted-foreground">
            {settings.layout === "cutout"
              ? "Kształty stykają się wspólną krawędzią bez nakładania — warstwy kolorów nadają się do separacji, folii i sitodruku."
              : "Kształty nakładają się jak w malarstwie warstwowym — mniejszy plik, ale warstwy zachowują kolejność rysowania."}
          </p>
        </PanelSection>

        <PanelSection title="Warstwy i grupy">
          <CustomSelect
            label="Podział na warstwy"
            value={settings.layering}
            onChange={(v) => {
              const strategy = LAYERING_STRATEGIES.find((s) => s === v);
              if (strategy) update("layering", strategy);
            }}
            options={LAYERING_STRATEGIES.map((value) => ({ value, label: LAYERING_LABELS[value] }))}
          />
          {settings.layout === "stacked" ? (
            <p className="text-[11px] leading-snug text-muted-foreground">
              W trybie stosu warstwy to kolejne plany (duże formy → detale).
            </p>
          ) : null}
          <SliderField
            label="Maksymalnie warstw"
            value={settings.maxLayers}
            min={2}
            max={32}
            onChange={(v) => update("maxLayers", v)}
            disabled={settings.layering !== "auto" && settings.layering !== "tone"}
          />
          <SwitchField
            label="Osobna warstwa tła"
            hint="Kolor dominujący na krawędziach obrazu."
            checked={settings.separateBackground}
            onChange={(v) => update("separateBackground", v)}
          />
          <SwitchField
            label="Grupuj sąsiednie kształty w obiekty"
            checked={settings.groupObjects}
            onChange={(v) => update("groupObjects", v)}
          />
          <SliderField
            label="Odległość łączenia obiektów"
            value={settings.groupGap}
            min={0}
            max={10}
            step={0.5}
            onChange={(v) => update("groupGap", v)}
            format={(v) => `${v.toLocaleString("pl-PL")}%`}
            disabled={!settings.groupObjects}
          />
        </PanelSection>

        <OutlineSection />
      </div>

      <div className="space-y-3 border-t border-border bg-background/30 p-4">
        <SwitchField label="Aktualizuj na bieżąco" checked={autoTrace} onChange={setAutoTrace} />
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant={needsRetrace ? "default" : "outline"}
            disabled={!hasDoc || busy}
            onClick={retrace}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {busy ? "Przetwarzam…" : "Wektoryzuj ponownie"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Przywróć ustawienia presetu"
            title="Przywróć ustawienia presetu"
            onClick={() => applyPreset(settings.preset === "custom" ? "photo" : settings.preset)}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
