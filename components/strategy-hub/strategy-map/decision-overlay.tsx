"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DecisionRow {
  id: string;
  title: string;
  reasonMd: string | null;
  evidenceMd: string | null;
  status: string | null;
}

interface ChainLink {
  decisionId: string;
  entityType: string;
  entityId: string;
  role: string;
}

interface DecisionOverlayProps {
  projectId: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  open: boolean;
  onClose: () => void;
}

export function DecisionOverlay({
  projectId,
  entityType,
  entityId,
  entityLabel,
  open,
  onClose,
}: DecisionOverlayProps) {
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [chain, setChain] = useState<ChainLink[]>([]);

  const load = useCallback(async () => {
    // `loading` startuje `true`; brak synchronicznego setState przed await, żeby
    // wywołanie `load()` w efekcie nie łamało reguły set-state-in-effect.
    try {
      const params = new URLSearchParams({ entityType, entityId });
      const res = await fetch(
        `/api/strategy-hub/projects/${projectId}/decision-trail?${params}`
      );
      if (!res.ok) return;
      const data = (await res.json()) as {
        decisions: DecisionRow[];
        chain: ChainLink[];
      };
      setDecisions(data.decisions ?? []);
      setChain(data.chain ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId, entityType, entityId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const causes = chain.filter(
    (l) => l.role === "cause" && l.entityId !== entityId
  );
  const effects = chain.filter(
    (l) => l.role === "effect" && l.entityId !== entityId
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-labelledby="decision-overlay-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Zamknij"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <div className="flex items-center gap-2 text-brand">
              <HelpCircle className="size-4" aria-hidden />
              <span className="text-xs font-medium uppercase tracking-wide">
                Dlaczego tak?
              </span>
            </div>
            <h2 id="decision-overlay-title" className="mt-1 text-sm font-semibold">
              {entityLabel}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={onClose}
            aria-label="Zamknij overlay"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Ładowanie decyzji…
            </div>
          ) : decisions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Brak powiązanych decyzji strategicznych. Dodaj je w{" "}
              <span className="text-foreground">Fundament → Decyzje</span>.
            </p>
          ) : (
            <>
              {decisions.map((d) => (
                <article
                  key={d.id}
                  className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2"
                >
                  <h3 className="text-sm font-medium">{d.title}</h3>
                  {d.reasonMd && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                      {d.reasonMd}
                    </p>
                  )}
                  {d.evidenceMd && (
                    <p className="text-xs text-muted-foreground/80 italic whitespace-pre-wrap">
                      Dowód: {d.evidenceMd}
                    </p>
                  )}
                </article>
              ))}

              {(causes.length > 0 || effects.length > 0) && (
                <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ścieżka wstecz
                  </p>
                  {causes.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {causes.map((c) => (
                        <li
                          key={`${c.decisionId}-${c.entityId}`}
                          className={cn(
                            "rounded-md px-2 py-1 bg-orange-500/10 text-orange-300"
                          )}
                        >
                          Przyczyna: {c.entityType} · {c.entityId.slice(0, 8)}…
                        </li>
                      ))}
                    </ul>
                  )}
                  {effects.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {effects.map((c) => (
                        <li
                          key={`${c.decisionId}-${c.entityId}-fx`}
                          className="rounded-md px-2 py-1 bg-emerald-500/10 text-emerald-300"
                        >
                          Skutek: {c.entityType} · {c.entityId.slice(0, 8)}…
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
