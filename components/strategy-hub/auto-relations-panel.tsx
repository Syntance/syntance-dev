"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RelationKind = "campaign" | "channel" | "kpi";

interface SuggestedTarget {
  kind: RelationKind;
  targetId: string;
  targetLabel: string;
  reason: string;
}

interface ElementSuggestion {
  elementId: string;
  elementLabel: string;
  segmentLabel: string | null;
  phase: string | null;
  targets: SuggestedTarget[];
}

const KIND_LABEL: Record<RelationKind, string> = {
  campaign: "Kampania",
  channel: "Kanał",
  kpi: "KPI",
};

const KIND_TONE: Record<RelationKind, string> = {
  campaign: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  channel: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  kpi: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function keyOf(elementId: string, t: SuggestedTarget) {
  return `${elementId}:${t.kind}:${t.targetId}`;
}

export function AutoRelationsPanel({
  projectId,
  onApplied,
}: {
  projectId: string;
  onApplied?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [suggestions, setSuggestions] = useState<ElementSuggestion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setDoneMsg(null);
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/auto-relations`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (res.ok) {
        const data = (await res.json()) as { suggestions: ElementSuggestion[] };
        setSuggestions(data.suggestions ?? []);
        // domyślnie zaznacz wszystkie
        const all = new Set<string>();
        for (const s of data.suggestions ?? []) {
          for (const t of s.targets) all.add(keyOf(s.elementId, t));
        }
        setSelected(all);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function toggle(elementId: string, t: SuggestedTarget) {
    const k = keyOf(elementId, t);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const totalTargets = suggestions.reduce((n, s) => n + s.targets.length, 0);

  async function apply() {
    const relations: { elementId: string; kind: RelationKind; targetId: string }[] = [];
    for (const s of suggestions) {
      for (const t of s.targets) {
        if (selected.has(keyOf(s.elementId, t))) {
          relations.push({ elementId: s.elementId, kind: t.kind, targetId: t.targetId });
        }
      }
    }
    if (relations.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/auto-relations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ relations }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as { inserted: number };
        setDoneMsg(`Utworzono ${data.inserted} powiązań. Graf wpływu zaktualizowany.`);
        setSuggestions([]);
        setSelected(new Set());
        onApplied?.();
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-brand/40 bg-brand/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Sparkles className="size-4 text-brand mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold">Automatyczne relacje</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Proponuje powiązania elementów lejka z kampaniami, kanałami i KPI
              na podstawie wspólnego segmentu i etapu. Ty decydujesz, co zapisać.
            </p>
          </div>
        </div>
        {!open ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setOpen(true)}
          >
            <Link2 className="size-3.5" /> Zaproponuj
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "Odśwież"
            )}
          </Button>
        )}
      </div>

      {doneMsg && <p className="text-xs text-success">{doneMsg}</p>}

      {open && (
        <>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Analizuję strategię…
            </div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Brak nowych sugestii. Upewnij się, że masz elementy lejka z
              przypisanym segmentem/etapem oraz kampanie/kanały/KPI dla tych
              segmentów.
            </p>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div
                  key={s.elementId}
                  className="rounded-lg border border-border bg-background/40 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium">{s.elementLabel}</span>
                    {s.segmentLabel && (
                      <span className="text-xs text-muted-foreground">
                        · {s.segmentLabel}
                      </span>
                    )}
                    {s.phase && (
                      <Badge variant="outline" className="text-[10px]">
                        {s.phase}
                      </Badge>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {s.targets.map((t) => {
                      const k = keyOf(s.elementId, t);
                      const isOn = selected.has(k);
                      return (
                        <li key={k}>
                          <button
                            type="button"
                            onClick={() => toggle(s.elementId, t)}
                            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/50"
                          >
                            <span
                              className={`flex size-4 items-center justify-center rounded border ${
                                isOn
                                  ? "bg-brand border-brand text-white"
                                  : "border-border"
                              }`}
                            >
                              {isOn && <Check className="size-3" />}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${KIND_TONE[t.kind]}`}
                            >
                              {KIND_LABEL[t.kind]}
                            </Badge>
                            <span className="text-sm flex-1 truncate">
                              {t.targetLabel}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {t.reason}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-xs text-muted-foreground">
                  Zaznaczono {selected.size} z {totalTargets}
                </span>
                <Button
                  type="button"
                  size="sm"
                  disabled={applying || selected.size === 0}
                  onClick={() => void apply()}
                >
                  {applying ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Zastosuj wybrane
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
