"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  ArrowUpFromLine,
  ArrowDownToLine,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SyncProject {
  id: string;
  name: string;
  icon: string | null;
  hasNotionPage: boolean;
  lastSync: {
    direction: string;
    status: string;
    syncedAt: string | null;
    error: string | null;
  } | null;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-success">
        <CheckCircle2 className="size-3.5" /> OK
      </span>
    );
  if (status.startsWith("skipped"))
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <CircleDashed className="size-3.5" />
        {status === "skipped_self_echo" ? "echo (anti-loop)" : "bez zmian"}
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="size-3.5" /> błąd
      </span>
    );
  return <span className="text-xs text-muted-foreground">{status}</span>;
}

export function SyncDashboard({ projects }: { projects: SyncProject[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<Record<string, string>>({});

  const push = async (projectId: string) => {
    setBusy(projectId);
    setFeedback((f) => ({ ...f, [projectId]: "" }));
    try {
      const res = await fetch("/api/strategy-hub/notion/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Push nie powiódł się");
      setFeedback((f) => ({ ...f, [projectId]: "Wypchnięto do Notion" }));
      router.refresh();
    } catch (err) {
      setFeedback((f) => ({
        ...f,
        [projectId]: err instanceof Error ? err.message : "Błąd",
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Sync z Notion</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Dwukierunkowa synchronizacja strategii biznesowej. Push wypycha
          markdown do strony Notion; webhook pobiera zmiany z powrotem.
          Echo własnych zmian jest ignorowane (anti-loop).
        </p>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center text-sm text-muted-foreground">
          Brak projektów.
        </div>
      ) : (
        <div className="space-y-2.5">
          {projects.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-card p-4 flex items-center gap-4"
            >
              <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
                {p.icon ?? "🏢"}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/strategy-hub/projects/${p.id}`}
                  className="text-sm font-medium hover:text-brand transition-colors truncate inline-flex items-center gap-1"
                >
                  {p.name}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  {p.lastSync ? (
                    <>
                      {p.lastSync.direction === "push" ? (
                        <ArrowUpFromLine className="size-3" />
                      ) : (
                        <ArrowDownToLine className="size-3" />
                      )}
                      <StatusBadge status={p.lastSync.status} />
                      <span className="opacity-60">
                        · {formatWhen(p.lastSync.syncedAt)}
                      </span>
                    </>
                  ) : (
                    <span className="opacity-60">Brak synchronizacji</span>
                  )}
                </div>
                {feedback[p.id] && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {feedback[p.id]}
                  </p>
                )}
              </div>

              {p.hasNotionPage ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => push(p.id)}
                  disabled={busy === p.id}
                >
                  {busy === p.id ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowUpFromLine className="size-3.5" />
                  )}
                  Push
                </Button>
              ) : (
                <Badge variant="secondary" className="text-[10px]">
                  brak strony Notion
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card/40 p-4 text-xs text-muted-foreground space-y-1">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <ExternalLink className="size-3.5" /> Webhook (pull)
        </div>
        <p>
          Endpoint: <span className="font-mono">/api/strategy-hub/notion/webhook</span>.
          Skonfiguruj w Notion → Settings → Connections → Webhooks. Zmiany na
          stronie wracają automatycznie do Hubu.
        </p>
      </div>
    </div>
  );
}
