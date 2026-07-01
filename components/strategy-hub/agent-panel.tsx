"use client";

import * as React from "react";
import {
  Search,
  Sparkles,
  Wand2,
  BellRing,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

type AgentMode = "audit" | "research" | "improve" | "monitor";

const MODES: {
  key: AgentMode;
  label: string;
  icon: typeof Search;
  hint: string;
}[] = [
  {
    key: "audit",
    label: "Audyt",
    icon: Search,
    hint: "Szuka braków danych (obiekcje bez odpowiedzi/dowodu).",
  },
  {
    key: "research",
    label: "Research",
    icon: Sparkles,
    hint: "Proponuje nowego konkurenta na bazie segmentów projektu.",
  },
  {
    key: "improve",
    label: "Poprawa",
    icon: Wand2,
    hint: "Dopisuje treść (np. odpowiedź na obiekcję) — do akceptacji.",
  },
  {
    key: "monitor",
    label: "Monitoring",
    icon: BellRing,
    hint: "Zamienia aktywne alerty (KPI/domena/wizyty) na propozycje.",
  },
];

interface DiffEntry {
  before: unknown;
  after: unknown;
}

interface Proposal {
  id: string;
  mode: AgentMode;
  entityType: string | null;
  entityId: string | null;
  diff: Record<string, DiffEntry> | null;
  rationaleMd: string | null;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: string;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Agent AI — 4 tryby + kolejka `ai_proposals` (Faza 10, M3).
 * TWARDA zasada „zero direct write": agent nigdy nie zapisuje bezpośrednio do
 * encji strategicznych — tylko tu, po kliknięciu Akceptuj (accept-proposal.ts).
 */
export function AgentPanel({ projectId }: Props) {
  const base = `/api/strategy-hub/projects/${projectId}/agent`;
  const [proposals, setProposals] = React.useState<Proposal[]>([]);
  const [running, setRunning] = React.useState<AgentMode | null>(null);
  const [resolving, setResolving] = React.useState<string | null>(null);
  const [showResolved, setShowResolved] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(8000) });
      if (res.ok) setProposals((await res.json()).items ?? []);
    } catch {
      /* ignore */
    }
  }, [base]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount, unavoidable
    void load();
  }, [load]);

  const run = async (mode: AgentMode) => {
    setRunning(mode);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      if (res.ok) void load();
    } catch (err) {
      console.error("agent run failed", err);
    } finally {
      setRunning(null);
    }
  };

  const resolve = async (id: string, action: "accept" | "reject") => {
    setResolving(id);
    try {
      const res = await fetch(`${base}/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) void load();
    } catch (err) {
      console.error("agent resolve failed", err);
    } finally {
      setResolving(null);
    }
  };

  const pending = proposals.filter((p) => p.status === "pending");
  const resolved = proposals.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-4">
      <SectionCard
        title="Agent AI — 4 tryby"
        description="Każdy tryb generuje propozycje w kolejce poniżej. Żadna zmiana nie trafia do projektu bez Twojej akceptacji."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <div
              key={m.key}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3"
            >
              <div className="flex items-center gap-2">
                <m.icon className="size-4 text-brand" />
                <span className="text-sm font-medium">{m.label}</span>
              </div>
              <p className="flex-1 text-xs text-muted-foreground">{m.hint}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void run(m.key)}
                disabled={running === m.key}
                className="h-7 gap-1.5 text-xs"
              >
                {running === m.key ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <m.icon className="size-3.5" />
                )}
                Uruchom
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={`Do przeglądu (${pending.length})`}
        description="Zaakceptuj, aby zapisać zmianę w projekcie, albo odrzuć propozycję."
      >
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Brak oczekujących propozycji. Uruchom jeden z trybów agenta powyżej.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border bg-card/40 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-brand">
                    {MODES.find((m) => m.key === p.mode)?.label ?? p.mode}
                    {p.entityType && (
                      <span className="text-muted-foreground">
                        · {p.entityType}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString("pl-PL")}
                  </span>
                </div>
                {p.rationaleMd && (
                  <p className="text-sm">{p.rationaleMd}</p>
                )}
                {p.diff && (
                  <div className="space-y-1 rounded-lg bg-muted/30 p-2 text-xs">
                    {Object.entries(p.diff).map(([field, d]) => (
                      <div key={field} className="flex gap-2">
                        <span className="shrink-0 font-medium text-muted-foreground">
                          {field}:
                        </span>
                        <span className="text-muted-foreground line-through">
                          {fmt(d.before)}
                        </span>
                        <span>→</span>
                        <span className="font-medium">{fmt(d.after)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    onClick={() => void resolve(p.id, "accept")}
                    disabled={resolving === p.id}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Check className="size-3.5" /> Akceptuj
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void resolve(p.id, "reject")}
                    disabled={resolving === p.id}
                    className="h-7 gap-1.5 text-xs text-muted-foreground"
                  >
                    <X className="size-3.5" /> Odrzuć
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {resolved.length > 0 && (
        <SectionCard title="Historia">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowResolved((v) => !v)}
            className="h-7 px-0 text-xs text-muted-foreground"
          >
            {showResolved ? "Zwiń" : `Pokaż ${resolved.length} rozstrzygniętych`}
          </Button>
          {showResolved && (
            <ul className="mt-2 divide-y divide-border/60 text-sm">
              {resolved.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 py-1.5"
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {MODES.find((m) => m.key === p.mode)?.label ?? p.mode}
                  </span>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {p.rationaleMd}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      p.status === "accepted"
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  >
                    {p.status === "accepted" ? "Zaakceptowano" : "Odrzucono"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
