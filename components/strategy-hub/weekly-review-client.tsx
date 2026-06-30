"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectAlert } from "@/lib/strategy-hub/alerts";

interface ChangeRow {
  entityType: string;
  field: string | null;
  newValue: string | null;
  createdAt: string;
  source: string;
}

interface Props {
  projectId: string;
  projectName: string;
}

export function WeeklyReviewClient({ projectId, projectName }: Props) {
  const [changes, setChanges] = useState<ChangeRow[]>([]);
  const [alerts, setAlerts] = useState<ProjectAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/strategy-hub/projects/${projectId}/change-history?limit=30`).then(
        (r) => (r.ok ? r.json() : { items: [] })
      ),
      fetch(`/api/strategy-hub/projects/${projectId}/alerts`).then((r) =>
        r.ok ? r.json() : { alerts: [] }
      ),
    ])
      .then(([hist, al]) => {
        const weekAgo = Date.now() - 7 * 86400000;
        setChanges(
          ((hist.items ?? []) as ChangeRow[]).filter(
            (c) => new Date(c.createdAt).getTime() >= weekAgo
          )
        );
        setAlerts((al.alerts ?? []) as ProjectAlert[]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  function exportPdf() {
    window.print();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Ładowanie review…
      </div>
    );
  }

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="text-sm text-muted-foreground">
          Podsumowanie 7 dni · {projectName}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={exportPdf}>
          <Download className="size-3.5" /> Eksport PDF (druk)
        </Button>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-400" />
          Alerty ({alerts.length})
        </h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak alertów wg progów reguł.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-medium">{a.title}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Co zmieniono (7 dni)</h2>
        {changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak wpisów w changeHistory.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {changes.map((c, i) => (
              <li key={`${c.createdAt}-${i}`} className="text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("pl-PL")} · {c.entityType}
                {c.field ? `.${c.field}` : ""} · {c.source}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 print:hidden">
        <h2 className="text-sm font-semibold">To-do</h2>
        <ul className="text-sm text-muted-foreground list-disc pl-5">
          <li>Przejrzyj KPI z czerwonej listy</li>
          <li>Zaktualizuj decyzje strategiczne po review z klientem</li>
          <li>
            <Link
              href={`/strategy-hub/projects/${projectId}/measurement/kpi`}
              className="text-brand hover:underline"
            >
              Otwórz KPI
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
