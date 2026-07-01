"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SectionCard,
  AutosaveField,
  useSingleton,
} from "@/components/strategy-hub/entity-singleton";
import {
  resolveCriteria,
  type ScoringCriterion,
} from "@/lib/strategy-hub/segment-scoring";

interface Dimension {
  dimension: string;
  description?: string;
  values?: string[];
}

interface Props {
  projectId: string;
}

/**
 * Kryteria segmentacji rynku — wymiary (dimension/description/values) używane
 * do wyznaczania segmentów (spec: /market/segmentation, Faza 3, M1).
 */
export function MarketSegmentationEditor({ projectId }: Props) {
  const { data, loaded, status, patch } = useSingleton(projectId, "market-segmentation");
  const dims: Dimension[] = Array.isArray(data.dimensions)
    ? (data.dimensions as Dimension[])
    : [];

  const updateDims = (next: Dimension[]) => patch({ dimensions: next });

  const updateDim = (idx: number, partial: Partial<Dimension>) => {
    updateDims(dims.map((d, i) => (i === idx ? { ...d, ...partial } : d)));
  };

  const addDim = () => updateDims([...dims, { dimension: "", description: "", values: [] }]);
  const removeDim = (idx: number) => updateDims(dims.filter((_, i) => i !== idx));

  const criteria = resolveCriteria(data.scoringCriteria);

  const updateCriteria = (next: ScoringCriterion[]) => patch({ scoringCriteria: next });
  const updateCriterion = (idx: number, partial: Partial<ScoringCriterion>) =>
    updateCriteria(criteria.map((c, i) => (i === idx ? { ...c, ...partial } : c)));
  const addCriterion = () => {
    // eslint-disable-next-line react-hooks/purity -- runs only inside onClick, never during render
    const key = `custom_${criteria.length}_${Date.now()}`;
    updateCriteria([...criteria, { key, label: "", weight: 3 }]);
  };
  const removeCriterion = (idx: number) => updateCriteria(criteria.filter((_, i) => i !== idx));

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      <SectionCard
        title="Wymiary segmentacji"
        description="Kryteria, wg których dzielimy rynek na segmenty (np. wielkość firmy, branża, poziom świadomości)."
        status={status}
      >
        <div className="space-y-3">
          {dims.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Brak wymiarów. Dodaj pierwszy, aby ustrukturyzować segmentację.
            </p>
          )}
          {dims.map((d, idx) => (
            <div
              key={idx}
              className="space-y-2 rounded-lg border border-border bg-card/40 p-3"
            >
              <div className="flex items-center gap-2">
                <Input
                  value={d.dimension}
                  onChange={(e) => updateDim(idx, { dimension: e.target.value })}
                  placeholder="Nazwa wymiaru (np. Wielkość firmy)"
                  className="h-8 flex-1 text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => removeDim(idx)}
                  aria-label="Usuń wymiar"
                  className="flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Input
                value={d.description ?? ""}
                onChange={(e) => updateDim(idx, { description: e.target.value })}
                placeholder="Opis wymiaru"
                className="h-8 text-xs"
              />
              <Input
                value={(d.values ?? []).join(", ")}
                onChange={(e) =>
                  updateDim(idx, {
                    values: e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Wartości oddzielone przecinkiem (np. mikro, małe, średnie, duże)"
                className="h-8 text-xs"
              />
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addDim}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" /> Dodaj wymiar
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Kryteria priorytetyzacji segmentów (wagi wg Negacza)"
        description="Wagi decydują o wyniku ważonym 0–100 w macierzy scoringu segmentów. Każdy segment oceniasz 1–5 na tych kryteriach."
        status={status}
      >
        <div className="space-y-2">
          {criteria.map((c, idx) => (
            <div key={c.key} className="flex items-center gap-2">
              <Input
                value={c.label}
                onChange={(e) => updateCriterion(idx, { label: e.target.value })}
                placeholder="Nazwa kryterium"
                className="h-8 flex-1 text-sm"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">Waga</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={c.weight}
                  onChange={(e) => updateCriterion(idx, { weight: Number(e.target.value) })}
                  className="w-20 accent-brand"
                />
                <span className="w-4 text-center text-xs font-medium tabular-nums">
                  {c.weight}
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeCriterion(idx)}
                aria-label="Usuń kryterium"
                className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addCriterion}
            className="h-8 gap-1.5 text-xs"
          >
            <Plus className="size-3.5" /> Dodaj kryterium
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Notatki" status={status}>
        <AutosaveField
          bare
          value={data.notesMd}
          onCommit={(v) => patch({ notesMd: v })}
          multiline
          rows={5}
          placeholder="Dodatkowe uwagi o metodologii segmentacji…"
        />
      </SectionCard>
    </div>
  );
}
