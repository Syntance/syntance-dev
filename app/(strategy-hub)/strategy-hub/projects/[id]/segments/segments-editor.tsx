"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2, Users, Loader2, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useHubOverlays } from "@/components/strategy-hub/hub-overlays";
import {
  AutosaveField,
  SectionCard,
  SaveIndicator,
  useSingleton,
} from "@/components/strategy-hub/entity-singleton";
import {
  JsonListEditor,
  type JsonColumn,
} from "@/components/strategy-hub/json-list-editor";
import { EntityCrud, type FieldDef } from "@/components/strategy-hub/entity-crud";
import { SegmentB2bPricing } from "@/components/strategy-hub/segment-b2b-pricing";
import {
  VisibilityControl,
  type VisibilityStatus,
} from "@/components/strategy-hub/visibility-control";
import { EntityMetaPanel } from "@/components/strategy-hub/entity-meta-panel";
import {
  resolveCriteria,
  weightedScore,
} from "@/lib/strategy-hub/segment-scoring";

interface Props {
  projectId: string;
  projectName: string;
}

type Segment = { id: string; [k: string]: unknown };
type SaveStatus = "idle" | "saving" | "saved";

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

const dimensionCols: JsonColumn[] = [
  { key: "dimension", label: "Wymiar", placeholder: "np. Wielkość firmy" },
  { key: "description", label: "Opis", placeholder: "Jak różnicuje segmenty" },
];

const buyerFields: FieldDef[] = [
  { key: "name", label: "Etap", type: "text", primary: true },
  { key: "whatDoesMd", label: "Co robi klient", type: "textarea" },
  { key: "timeHint", label: "Czas", type: "text", placeholder: "np. 1-2 dni" },
  { key: "ourActionMd", label: "Nasza akcja", type: "textarea" },
];
const quickWinFields: FieldDef[] = [
  { key: "title", label: "Quick win", type: "text", primary: true },
  { key: "descriptionMd", label: "Opis", type: "textarea" },
  { key: "deadline", label: "Termin", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "select",
    badge: true,
    options: [
      { value: "planned", label: "Plan", tone: "neutral" },
      { value: "in_progress", label: "W toku", tone: "info" },
      { value: "done", label: "Gotowe", tone: "success" },
    ],
  },
];
const riskFields: FieldDef[] = [
  { key: "riskMd", label: "Ryzyko", type: "textarea", primary: true },
  { key: "mitigationMd", label: "Mitygacja", type: "textarea" },
  {
    key: "severity",
    label: "Waga",
    type: "select",
    badge: true,
    options: [
      { value: "low", label: "Niska", tone: "neutral" },
      { value: "medium", label: "Średnia", tone: "warning" },
      { value: "high", label: "Wysoka", tone: "danger" },
    ],
  },
];

export function SegmentsEditor({ projectId, projectName }: Props) {
  const base = `/api/strategy-hub/projects/${projectId}/segments`;
  const [segments, setSegments] = useState<Segment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [draftName, setDraftName] = useState("");
  const [pending, startTransition] = useTransition();
  const [visMap, setVisMap] = useState<Record<string, VisibilityStatus>>({});
  const { openSidekick } = useHubOverlays();

  const market = useSingleton(projectId, "market-segmentation");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/strategy-hub/projects/${projectId}/visibility`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { records?: Record<string, Record<string, VisibilityStatus>> } | null) =>
          setVisMap(d?.records?.segments ?? {})
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [projectId]);

  const pendingRef = useRef<Record<string, Record<string, unknown>>>({});
  const timerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(base, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((j) => {
        setSegments(j.items ?? []);
        if (j.items?.[0]) setSelectedId(j.items[0].id);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
    return () => ctrl.abort();
  }, [base]);

  const flush = useCallback(
    async (id: string) => {
      const patch = pendingRef.current[id];
      delete pendingRef.current[id];
      if (!patch || Object.keys(patch).length === 0) return;
      setStatus("saving");
      try {
        await fetch(`${base}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
          signal: AbortSignal.timeout(8000),
        });
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } catch (err) {
        console.error("segment save failed", err);
        setStatus("idle");
      }
    },
    [base]
  );

  const patchSegment = useCallback(
    (id: string, partial: Record<string, unknown>) => {
      setSegments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...partial } : s))
      );
      pendingRef.current[id] = { ...pendingRef.current[id], ...partial };
      clearTimeout(timerRef.current[id]);
      timerRef.current[id] = setTimeout(() => void flush(id), 600);
    },
    [flush]
  );

  const addSegment = () => {
    const name = draftName.trim();
    if (!name) return;
    startTransition(async () => {
      try {
        const res = await fetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, status: "active" }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const { item } = await res.json();
          setSegments((prev) => [...prev, item]);
          setSelectedId(item.id);
          setDraftName("");
        }
      } catch (err) {
        console.error("add segment failed", err);
      }
    });
  };

  const removeSegment = (id: string) => {
    startTransition(async () => {
      setSegments((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) setSelectedId(null);
      try {
        await fetch(`${base}/${id}`, {
          method: "DELETE",
          signal: AbortSignal.timeout(8000),
        });
      } catch (err) {
        console.error("remove segment failed", err);
      }
    });
  };

  const selected = segments.find((s) => s.id === selectedId) ?? null;
  const scoring = (selected?.scoring as Record<string, unknown>) ?? {};
  const criteria = resolveCriteria(market.data.scoringCriteria);

  const setScore = (key: string, value: string) => {
    if (!selected) return;
    const next = { ...scoring, [key]: value === "" ? null : Number(value) };
    patchSegment(selected.id, { scoring: next });
  };

  const ranked = [...segments]
    .map((s) => ({
      seg: s,
      score: weightedScore(s.scoring as Record<string, unknown> | null, criteria),
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const applyPriorityFromRanking = () => {
    ranked.forEach(({ seg }, idx) => {
      if (seg.priority !== idx + 1) patchSegment(seg.id, { priority: idx + 1 });
    });
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <header>
        <p className="text-xs font-medium text-muted-foreground">{projectName}</p>
        <h1 className="text-xl font-semibold tracking-tight">Segmenty</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grupy docelowe — persona, JTBD, psychologia zakupu, ścieżka, quick wins
          i ryzyka.
        </p>
      </header>

      {/* Kryteria segmentacji */}
      <SectionCard
        title="Kryteria segmentacji"
        description="Wymiary, według których dzielimy rynek."
        status={market.status}
      >
        <JsonListEditor
          value={
            Array.isArray(market.data.dimensions)
              ? (market.data.dimensions as Record<string, unknown>[])
              : []
          }
          columns={dimensionCols}
          onChange={(next) => market.patch({ dimensions: next })}
          addLabel="Dodaj wymiar"
          emptyHint="Brak zdefiniowanych kryteriów."
        />
      </SectionCard>

      {/* Priorytetyzacja segmentów — macierz scoringu ważonego */}
      {segments.length > 1 && (
        <SectionCard
          title="Priorytetyzacja segmentów"
          description="Ranking wg wyniku ważonego (kryteria + wagi z zakładki Kryteria segmentacji)."
        >
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-1 text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="text-left font-medium p-1.5">#</th>
                    <th className="text-left font-medium p-1.5">Segment</th>
                    <th className="text-left font-medium p-1.5">Wynik ważony</th>
                    <th className="text-left font-medium p-1.5">Priorytet obecny</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ seg, score }, idx) => (
                    <tr
                      key={seg.id}
                      className="cursor-pointer rounded-lg hover:bg-muted/40"
                      onClick={() => setSelectedId(seg.id)}
                    >
                      <td className="p-1.5 font-medium text-muted-foreground">{idx + 1}</td>
                      <td className="p-1.5">
                        {String(seg.icon ?? "👥")} {String(seg.name)}
                      </td>
                      <td className="p-1.5">
                        {score == null ? (
                          <span className="text-xs text-muted-foreground">brak ocen</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  score >= 70
                                    ? "bg-success"
                                    : score >= 40
                                    ? "bg-amber-400"
                                    : "bg-destructive"
                                )}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium tabular-nums">{score}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-1.5 text-xs text-muted-foreground">
                        {seg.priority == null ? "—" : String(seg.priority)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={applyPriorityFromRanking}
              className="h-8 text-xs"
            >
              Zastosuj ranking jako priorytet
            </Button>
          </div>
        </SectionCard>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        {/* Lista segmentów */}
        <aside className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSegment()}
              placeholder="Nazwa segmentu…"
              aria-label="Nowy segment"
              className="h-8 text-sm"
              disabled={pending}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={addSegment}
              disabled={!draftName.trim() || pending}
              className="h-8 shrink-0 px-2"
              aria-label="Dodaj segment"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {!loaded ? (
            <div className="flex items-center gap-2 px-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Ładowanie…
            </div>
          ) : segments.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">
              Brak segmentów — dodaj pierwszy.
            </p>
          ) : (
            <ul className="space-y-1">
              {segments.map((s) => {
                const isActive = s.id === selectedId;
                const st = String(s.status ?? "active");
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "group w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-brand/40 bg-brand/5"
                          : "border-border bg-card/40 hover:border-border/80"
                      )}
                    >
                      <span className="text-base leading-none">
                        {String(s.icon ?? "👥")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">
                          {String(s.name)}
                        </span>
                        {s.personaName != null && s.personaName !== "" && (
                          <span className="block text-xs text-muted-foreground truncate">
                            {String(s.personaName)}
                          </span>
                        )}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] h-4 px-1.5 border shrink-0",
                          STATUS_TONE[st] ?? STATUS_TONE.archived
                        )}
                      >
                        {st}
                      </Badge>
                      <ChevronRight
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          isActive ? "text-brand" : "text-muted-foreground/40"
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Detal segmentu */}
        {selected ? (
          <div className="space-y-5 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <SaveIndicator status={status} />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openSidekick(
                      `Zaproponuj kompletny lejek (etapy zakupu TOFU/MOFU/BOFU/retencja + elementy lejka z formatem i CTA) dla segmentu „${selected.name}". Uwzględnij JTBD, problem i UVP tego segmentu jeśli są opisane.`
                    )
                  }
                  className="h-8 gap-1.5 text-xs"
                >
                  <Sparkles className="size-3.5" />
                  Generuj lejek
                </Button>
                <VisibilityControl
                  projectId={projectId}
                  scope="record"
                  entityType="segments"
                  entityId={selected.id}
                  initialStatus={visMap[selected.id] ?? "visible"}
                  variant="chip"
                  onChange={(s) =>
                    setVisMap((m) => ({ ...m, [selected.id]: s }))
                  }
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeSegment(selected.id)}
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                  Usuń segment
                </Button>
              </div>
            </div>

            <SectionCard title="Podstawowe">
              <div className="grid gap-4 sm:grid-cols-2">
                <AutosaveField
                  label="Nazwa"
                  value={selected.name}
                  onCommit={(v) => patchSegment(selected.id, { name: v })}
                />
                <AutosaveField
                  label="Persona"
                  value={selected.personaName}
                  onCommit={(v) => patchSegment(selected.id, { personaName: v })}
                />
                <AutosaveField
                  label="Kod"
                  value={selected.code}
                  onCommit={(v) => patchSegment(selected.id, { code: v })}
                />
                <AutosaveField
                  label="Ikona (emoji)"
                  value={selected.icon}
                  onCommit={(v) => patchSegment(selected.id, { icon: v })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={String(selected.status ?? "active")}
                    onChange={(e) =>
                      patchSegment(selected.id, { status: e.target.value })
                    }
                    className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <option value="active">Aktywny</option>
                    <option value="paused">Wstrzymany</option>
                    <option value="archived">Archiwum</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Priorytet</label>
                  <Input
                    type="number"
                    value={selected.priority == null ? "" : String(selected.priority)}
                    onChange={(e) =>
                      patchSegment(selected.id, {
                        priority:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Udział w przych. (%)</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={
                      selected.revenueSharePct == null
                        ? ""
                        : String(selected.revenueSharePct)
                    }
                    onChange={(e) =>
                      patchSegment(selected.id, {
                        revenueSharePct:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Profil">
              <AutosaveField
                label="Demografia"
                value={selected.demographicsMd}
                onCommit={(v) => patchSegment(selected.id, { demographicsMd: v })}
                multiline
              />
              <AutosaveField
                label="JTBD (Jobs To Be Done)"
                value={selected.jtbdMd}
                onCommit={(v) => patchSegment(selected.id, { jtbdMd: v })}
                multiline
              />
              <AutosaveField
                label="Problem"
                value={selected.problemMd}
                onCommit={(v) => patchSegment(selected.id, { problemMd: v })}
                multiline
              />
              <AutosaveField
                label="UVP dla segmentu"
                value={selected.uvpForSegmentMd}
                onCommit={(v) =>
                  patchSegment(selected.id, { uvpForSegmentMd: v })
                }
                multiline
              />
            </SectionCard>

            <SectionCard title="Psychologia zakupu">
              <AutosaveField
                label="Drivery emocjonalne"
                value={selected.emotionalDriversMd}
                onCommit={(v) =>
                  patchSegment(selected.id, { emotionalDriversMd: v })
                }
                multiline
              />
              <AutosaveField
                label="Triggery"
                value={selected.triggersMd}
                onCommit={(v) => patchSegment(selected.id, { triggersMd: v })}
                multiline
              />
              <AutosaveField
                label="Blokery"
                value={selected.blockersMd}
                onCommit={(v) => patchSegment(selected.id, { blockersMd: v })}
                multiline
              />
              <AutosaveField
                label="Mentalność"
                value={selected.mentalityMd}
                onCommit={(v) => patchSegment(selected.id, { mentalityMd: v })}
                multiline
              />
            </SectionCard>

            <SectionCard title="Budżet i rynek">
              <AutosaveField
                label="Budżet"
                value={selected.budgetMd}
                onCommit={(v) => patchSegment(selected.id, { budgetMd: v })}
                multiline
                rows={3}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Cennik B2B</label>
                <SegmentB2bPricing
                  value={(selected.segmentPricingMd as string | null) ?? null}
                  onCommit={(v) =>
                    patchSegment(selected.id, { segmentPricingMd: v })
                  }
                />
              </div>
              <AutosaveField
                label="Wielkość rynku"
                value={selected.marketSizeMd}
                onCommit={(v) => patchSegment(selected.id, { marketSizeMd: v })}
                multiline
                rows={3}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dane rynkowe</label>
                <JsonListEditor
                  value={
                    Array.isArray(selected.marketData)
                      ? (selected.marketData as Record<string, unknown>[])
                      : []
                  }
                  columns={[
                    { key: "label", label: "Etykieta", placeholder: "np. TAM" },
                    { key: "value", label: "Wartość" },
                    { key: "source", label: "Źródło" },
                  ]}
                  onChange={(next) =>
                    patchSegment(selected.id, { marketData: next })
                  }
                  addLabel="Dodaj pozycję"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Scoring"
              description="Ocena 1–5 na kryteriach z zakładki Kryteria segmentacji. Waga decyduje o wpływie na wynik ważony."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                {criteria.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {c.label}
                      <span className="ml-1 text-xs text-muted-foreground">
                        (waga {c.weight})
                      </span>
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={scoring[c.key] == null ? "" : String(scoring[c.key])}
                      onChange={(e) => setScore(c.key, e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                ))}
              </div>
              {(() => {
                const total = weightedScore(scoring, criteria);
                return total != null ? (
                  <p className="text-sm font-medium">
                    Wynik ważony:{" "}
                    <span
                      className={cn(
                        total >= 70
                          ? "text-success"
                          : total >= 40
                          ? "text-amber-500"
                          : "text-destructive"
                      )}
                    >
                      {total}/100
                    </span>
                  </p>
                ) : null;
              })()}
            </SectionCard>

            <SectionCard
              title="Ścieżka zakupowa"
              description="Etapy podróży klienta w tym segmencie."
            >
              <EntityCrud
                projectId={projectId}
                entity="buyer-journey"
                basePath={`${base}/${selected.id}/buyer-journey`}
                fields={buyerFields}
                addLabel="Dodaj etap"
                emptyHint="Brak etapów ścieżki."
                dense
              />
            </SectionCard>

            <SectionCard title="Quick wins">
              <EntityCrud
                projectId={projectId}
                entity="quick-wins"
                basePath={`${base}/${selected.id}/quick-wins`}
                fields={quickWinFields}
                addLabel="Dodaj quick win"
                emptyHint="Brak quick winów."
                dense
              />
            </SectionCard>

            <SectionCard title="Ryzyka">
              <EntityCrud
                projectId={projectId}
                entity="risks"
                basePath={`${base}/${selected.id}/risks`}
                fields={riskFields}
                addLabel="Dodaj ryzyko"
                emptyHint="Brak zidentyfikowanych ryzyk."
                dense
              />
            </SectionCard>

            <EntityMetaPanel
              projectId={projectId}
              entityType="segment"
              entityId={selected.id}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-border min-h-[300px]">
            <div className="text-center text-muted-foreground">
              <Users className="size-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Wybierz segment z listy albo dodaj nowy.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
