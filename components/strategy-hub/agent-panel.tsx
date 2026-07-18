"use client";

import * as React from "react";
import {
  Search,
  Sparkles,
  Wand2,
  BellRing,
  Loader2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/strategy-hub/entity-singleton";
import { apiFetch } from "@/lib/strategy-hub/api-fetch";
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
    hint: "Szuka braków danych i oznacza encje do przeglądu.",
  },
  {
    key: "research",
    label: "Research",
    icon: Sparkles,
    hint: "Dodaje propozycję konkurenta na bazie segmentów.",
  },
  {
    key: "improve",
    label: "Poprawa",
    icon: Wand2,
    hint: "Dopisuje treść (np. odpowiedź na obiekcję) — od razu w projekcie.",
  },
  {
    key: "monitor",
    label: "Monitoring",
    icon: BellRing,
    hint: "Reaguje na alerty KPI/domena/wizyty.",
  },
];

interface ActivityItem {
  id: string;
  mode: AgentMode;
  rationaleMd: string | null;
  batchId: string | null;
  createdAt: string;
  status: string;
}

export function AgentPanel({ projectId }: Props) {
  const base = `/api/strategy-hub/projects/${projectId}/agent`;
  const [items, setItems] = React.useState<ActivityItem[]>([]);
  const [running, setRunning] = React.useState<AgentMode | null>(null);
  const [undoing, setUndoing] = React.useState<string | null>(null);

  const refreshItems = React.useCallback(() => {
    void apiFetch<{ items?: ActivityItem[] }>(`${base}?status=applied`, {
      silent: true,
    })
      .then((data) => setItems(data.items ?? []))
      .catch(() => {}); // tło, niekrytyczne
  }, [base]);

  React.useEffect(() => {
    refreshItems();
  }, [refreshItems]);

  const run = async (mode: AgentMode) => {
    setRunning(mode);
    try {
      // Agent pracuje długo (LLM) — dłuższy timeout niż standardowe 8 s.
      await apiFetch(base, { method: "POST", json: { mode }, timeoutMs: 120_000 });
      refreshItems();
    } catch {
      // toast pokazuje apiFetch
    } finally {
      setRunning(null);
    }
  };

  const undo = async (batchId: string) => {
    setUndoing(batchId);
    try {
      await apiFetch(
        `/api/strategy-hub/projects/${projectId}/changes/${batchId}/undo`,
        { method: "POST", timeoutMs: 15_000 }
      );
      refreshItems();
    } catch {
      // toast pokazuje apiFetch
    } finally {
      setUndoing(null);
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Agent AI — aktywność"
        description="Agent stosuje zmiany od razu. Każdy przebieg ma batch — możesz cofnąć."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODES.map((m) => (
            <div
              key={m.key}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card/40 p-3"
            >
              <div className="flex items-center gap-2">
                <m.icon className="size-4 text-brand" aria-hidden />
                <span className="text-sm font-medium">{m.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{m.hint}</p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={running !== null}
                onClick={() => void run(m.key)}
                className="mt-auto"
              >
                {running === m.key ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Uruchamiam…
                  </>
                ) : (
                  "Uruchom"
                )}
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Ostatnie działania AI" description="Zastosowane zmiany z opcją cofnięcia.">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak aktywności agenta.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.mode}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    {item.rationaleMd ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString("pl-PL")}
                  </p>
                </div>
                {item.batchId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={undoing === item.batchId}
                    onClick={() => void undo(item.batchId!)}
                    className={cn("shrink-0 gap-1.5")}
                  >
                    {undoing === item.batchId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Undo2 className="size-3.5" />
                    )}
                    Cofnij
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
