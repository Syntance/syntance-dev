"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, TrendingUp, Loader2, Check, Hammer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/strategy-hub/sparkline";
import {
  VisibilityControl,
  type VisibilityStatus,
} from "@/components/strategy-hub/visibility-control";
import { EntityMetaPanel } from "@/components/strategy-hub/entity-meta-panel";

interface Snapshot {
  id: string;
  value: string;
  recordedAt: string;
}
interface Kpi {
  id: string;
  name: string;
  target: string | null;
  actual: string | null;
  unit: string | null;
  category: string | null;
  snapshots: Snapshot[];
}

interface Props {
  projectId: string;
  projectName: string;
  mode?: "editor" | "client";
}

function parseNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ─── Karta KPI ────────────────────────────────────────────────────────────────

function KpiCard({
  kpi,
  onActualCommit,
  onAddMeasurement,
  onDelete,
  projectId,
  visStatus,
  mode,
}: {
  kpi: Kpi;
  onActualCommit: (value: string) => void;
  onAddMeasurement: (value: string) => Promise<void>;
  onDelete: () => void;
  projectId: string;
  visStatus: VisibilityStatus;
  mode: "editor" | "client";
}) {
  const [actual, setActual] = useState(kpi.actual ?? "");
  const [measure, setMeasure] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync z propem bez efektu (React 19) — wzorzec „poprzedni prop".
  const [prevActual, setPrevActual] = useState(kpi.actual);
  if (kpi.actual !== prevActual) {
    setPrevActual(kpi.actual);
    setActual(kpi.actual ?? "");
  }

  const target = parseNum(kpi.target);
  const actualN = parseNum(kpi.actual);
  const progress =
    target != null && actualN != null && target !== 0
      ? Math.max(0, Math.min(1, actualN / target))
      : null;

  const series = kpi.snapshots
    .map((s) => parseNum(s.value))
    .filter((n): n is number => n != null);

  const commitActual = () => {
    if (actual !== (kpi.actual ?? "")) onActualCommit(actual);
  };

  const addMeasure = async () => {
    if (!measure.trim()) return;
    setSaving(true);
    await onAddMeasurement(measure.trim());
    setMeasure("");
    setSaving(false);
  };

  const wip = mode === "client" && visStatus === "in_progress";

  return (
    <div className="group rounded-xl border border-border bg-card/50 p-4 space-y-3 hover:border-border transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-medium truncate">{kpi.name}</h3>
          {kpi.category && (
            <Badge
              variant="outline"
              className="mt-1 text-[10px] h-4 px-1.5 border-border text-muted-foreground"
            >
              {kpi.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {wip && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
              <Hammer className="size-3" /> w budowie
            </span>
          )}
          {mode === "editor" && (
            <>
              <VisibilityControl
                projectId={projectId}
                scope="record"
                entityType="kpis"
                entityId={kpi.id}
                initialStatus={visStatus}
              />
              <button
                type="button"
                onClick={onDelete}
                aria-label="Usuń KPI"
                className="size-6 flex items-center justify-center rounded text-transparent group-hover:text-muted-foreground hover:text-destructive transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {!wip && (
        <>
          <div className="flex items-end justify-between gap-3">
            <div className="space-y-1">
              {/* Podpis wartości — nie zawsze ma sparowany control (tryb podglądu pokazuje tekst, nie Input), stąd span zamiast label. */}
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Aktualnie
              </span>
              <div className="flex items-baseline gap-1">
                {mode === "editor" ? (
                  <Input
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    onBlur={commitActual}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="h-8 w-20 text-base font-semibold tabular-nums px-2"
                    aria-label={`Aktualna wartość ${kpi.name}`}
                  />
                ) : (
                  <span className="text-xl font-semibold tabular-nums">
                    {kpi.actual ?? "—"}
                  </span>
                )}
                {kpi.unit && (
                  <span className="text-xs text-muted-foreground">{kpi.unit}</span>
                )}
              </div>
              {kpi.target && (
                <p className="text-[11px] text-muted-foreground">
                  Cel: {kpi.target}
                  {kpi.unit ? ` ${kpi.unit}` : ""}
                </p>
              )}
            </div>
            <Sparkline values={series} className="shrink-0" />
          </div>

          {progress != null && (
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    progress < 0.8 ? "bg-destructive" : "bg-success"
                  )}
                  style={{ width: `${(progress * 100).toFixed(0)}%` }}
                />
              </div>
              <p
                className={cn(
                  "text-[10px] text-right tabular-nums",
                  progress < 0.8 ? "text-destructive font-medium" : "text-muted-foreground"
                )}
              >
                {(progress * 100).toFixed(0)}% celu
                {progress < 0.8 ? " · poniżej 80%" : ""}
              </p>
            </div>
          )}

          {mode === "editor" && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
              <Input
                value={measure}
                onChange={(e) => setMeasure(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addMeasure();
                }}
                placeholder="Nowy pomiar…"
                className="h-7 text-xs px-2"
                aria-label="Nowy pomiar"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => void addMeasure()}
                disabled={!measure.trim() || saving}
                className="h-7 text-xs gap-1 shrink-0"
              >
                {saving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <TrendingUp className="size-3" />
                )}
                Zapisz
              </Button>
            </div>
          )}
        </>
      )}

      <EntityMetaPanel
        projectId={projectId}
        entityType="kpi"
        entityId={kpi.id}
        readOnly={mode === "client"}
      />
    </div>
  );
}

// ─── Główny dashboard ─────────────────────────────────────────────────────────

export function KpiClient({ projectId, projectName, mode = "editor" }: Props) {
  const base = `/api/strategy-hub/projects/${projectId}/kpis`;
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    target: "",
    unit: "",
    category: "",
  });
  const [savingNew, setSavingNew] = useState(false);
  const [visMap, setVisMap] = useState<Record<string, VisibilityStatus>>({});
  const mounted = useRef(true);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/strategy-hub/projects/${projectId}/visibility`, {
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: { records?: Record<string, Record<string, VisibilityStatus>> } | null) =>
          setVisMap(d?.records?.kpis ?? {})
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, [projectId]);

  const fetchSnapshots = useCallback(
    async (kpiId: string): Promise<Snapshot[]> => {
      try {
        const res = await fetch(`${base}/${kpiId}/snapshots`, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        return (await res.json()).items ?? [];
      } catch {
        return [];
      }
    },
    [base]
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const list: Omit<Kpi, "snapshots">[] = (await res.json()).items ?? [];
      const withSnaps = await Promise.all(
        list.map(async (k) => ({ ...k, snapshots: await fetchSnapshots(k.id) }))
      );
      if (mounted.current) setKpis(withSnaps);
    } catch {
      /* ignore */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [base, fetchSnapshots]);

  useEffect(() => {
    mounted.current = true;
    void (async () => {
      await load();
    })();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const patchKpi = async (id: string, data: Record<string, unknown>) => {
    setKpis((prev) =>
      prev.map((k) => (k.id === id ? { ...k, ...data } : k))
    );
    try {
      await fetch(`${base}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      void load();
    }
  };

  const addMeasurement = async (id: string, value: string) => {
    try {
      await fetch(`${base}/${id}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
        signal: AbortSignal.timeout(8000),
      });
      await patchKpi(id, { actual: value });
      const snaps = await fetchSnapshots(id);
      setKpis((prev) =>
        prev.map((k) => (k.id === id ? { ...k, snapshots: snaps } : k))
      );
    } catch {
      /* ignore */
    }
  };

  const removeKpi = async (id: string) => {
    setKpis((prev) => prev.filter((k) => k.id !== id));
    try {
      await fetch(`${base}/${id}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      void load();
    }
  };

  const addKpi = async () => {
    if (!draft.name.trim()) return;
    setSavingNew(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          target: draft.target || null,
          unit: draft.unit || null,
          category: draft.category || null,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        setDraft({ name: "", target: "", unit: "", category: "" });
        setAdding(false);
        await load();
      }
    } finally {
      setSavingNew(false);
    }
  };

  const categories = Array.from(
    new Set(kpis.map((k) => k.category ?? "Pozostałe"))
  );

  return (
    <div className="w-full min-w-0 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{projectName}</p>
          <h1 className="text-xl font-semibold tracking-tight">KPI</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cele liczbowe z trendem pomiarów i postępem względem targetu.
          </p>
        </div>
        {!adding && mode === "editor" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAdding(true)}
            className="h-8 text-xs gap-1.5 shrink-0"
          >
            <Plus className="size-3.5" />
            Nowy KPI
          </Button>
        )}
      </header>

      {adding && mode === "editor" && (
        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="new-kpi-name" className="text-xs font-medium text-muted-foreground">
                Nazwa
              </label>
              <Input
                id="new-kpi-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="np. Konwersja landing page"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-kpi-category" className="text-xs font-medium text-muted-foreground">
                Kategoria
              </label>
              <Input
                id="new-kpi-category"
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, category: e.target.value }))
                }
                placeholder="np. Akwizycja, Retencja"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-kpi-target" className="text-xs font-medium text-muted-foreground">
                Cel (target)
              </label>
              <Input
                id="new-kpi-target"
                value={draft.target}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, target: e.target.value }))
                }
                placeholder="np. 5"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-kpi-unit" className="text-xs font-medium text-muted-foreground">
                Jednostka
              </label>
              <Input
                id="new-kpi-unit"
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                placeholder="np. %, zł, szt."
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void addKpi()}
              disabled={!draft.name.trim() || savingNew}
              className="h-8 text-xs gap-1.5"
            >
              {savingNew ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Dodaj
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setAdding(false)}
              className="h-8 text-xs"
            >
              Anuluj
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Ładowanie KPI…
        </p>
      ) : kpis.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {mode === "client"
            ? "KPI są jeszcze opracowywane."
            : "Brak KPI — dodaj pierwszy cel liczbowy."}
        </p>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {kpis
                  .filter((k) => (k.category ?? "Pozostałe") === cat)
                  .map((kpi) => (
                    <KpiCard
                      key={kpi.id}
                      kpi={kpi}
                      mode={mode}
                      onActualCommit={(v) => patchKpi(kpi.id, { actual: v })}
                      onAddMeasurement={(v) => addMeasurement(kpi.id, v)}
                      onDelete={() => removeKpi(kpi.id)}
                      projectId={projectId}
                      visStatus={visMap[kpi.id] ?? "visible"}
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
