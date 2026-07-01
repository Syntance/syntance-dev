import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import {
  projects as dbProjects,
  healthScoreSnapshots,
  changeHistory,
  kpis,
} from "@/db/schema";
import { eq, isNull, and, asc, desc } from "drizzle-orm";
import { TrendingUp, Activity, Gauge } from "lucide-react";
import { computeProjectHealth } from "@/lib/strategy-hub/health-score";
import { Sparkline } from "@/components/strategy-hub/sparkline";

interface Props {
  params: Promise<{ slug: string }>;
}

const ENTITY_LABELS: Record<string, string> = {
  kpi: "KPI",
  kpis: "KPI",
  segment: "Segment",
  segments: "Segment",
  channel: "Kanał",
  channels: "Kanał",
  page: "Podstrona",
  pages: "Podstrona",
  business_strategy: "Strategia biznesowa",
  competitor: "Konkurencja",
  competitors: "Konkurencja",
  objection: "Obiekcja",
  objections: "Obiekcja",
};

function labelFor(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

async function getReportData(slug: string) {
  const rows = await db
    .select({ id: dbProjects.id })
    .from(dbProjects)
    .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
    .limit(1);
  if (!rows[0]) return null;

  const projectId = rows[0].id;

  const [health, snapshots, recentChanges, kpiRows] = await Promise.all([
    computeProjectHealth(projectId).catch(() => null),
    db
      .select({
        score: healthScoreSnapshots.score,
        capturedAt: healthScoreSnapshots.capturedAt,
      })
      .from(healthScoreSnapshots)
      .where(eq(healthScoreSnapshots.projectId, projectId))
      .orderBy(asc(healthScoreSnapshots.capturedAt))
      .limit(52),
    db
      .select({
        entityType: changeHistory.entityType,
        field: changeHistory.field,
        createdAt: changeHistory.createdAt,
      })
      .from(changeHistory)
      .where(eq(changeHistory.projectId, projectId))
      .orderBy(desc(changeHistory.createdAt))
      .limit(8),
    db
      .select({ name: kpis.name, target: kpis.target, actual: kpis.actual })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)))
      .limit(6),
  ]);

  return { health, snapshots, recentChanges, kpiRows };
}

export default async function ClientReportsPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect("/login");

  const { slug } = await params;

  let project;
  try {
    project = await getProjectBySlugForUser(slug, session.email);
  } catch {
    project = null;
  }
  if (!project) notFound();

  const data = await getReportData(slug);
  if (!data) notFound();

  const { health, snapshots, recentChanges, kpiRows } = data;
  const trendValues = snapshots.map((s) => s.score);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Raporty</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Postęp projektu w czasie — kompletność strategii, KPI i ostatnia aktywność.
        </p>
      </div>

      {/* Health score + trend */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <Gauge className="size-4 text-brand" /> Kompletność strategii
          </h2>
          {health && (
            <span className="text-2xl font-semibold tabular-nums">
              {health.score}
              <span className="text-sm text-muted-foreground">/100</span>
            </span>
          )}
        </div>

        {trendValues.length >= 2 ? (
          <div className="flex items-center gap-3">
            <Sparkline values={trendValues} width={240} height={40} />
            <span className="text-xs text-muted-foreground">
              {snapshots.length} pomiarów tygodniowych
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/70">
            Historia trendu buduje się co tydzień — wróć za kilka tygodni, żeby
            zobaczyć wykres postępu.
          </p>
        )}

        {health && health.modules.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2 pt-2 border-t border-border/60">
            {health.modules.map((m) => (
              <div key={m.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground truncate">{m.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${m.score}%` }}
                    />
                  </div>
                  <span className="tabular-nums w-8 text-right">{m.score}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KPI skrót */}
      {kpiRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-medium">KPI — bieżące wartości</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {kpiRows.map((k, i) => (
              <div
                key={`${k.name}-${i}`}
                className="flex items-center justify-between text-xs rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="text-muted-foreground truncate">{k.name}</span>
                <span className="tabular-nums font-medium">
                  {k.actual ?? "—"}
                  {k.target ? ` / ${k.target}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ostatnia aktywność */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Activity className="size-4 text-brand" /> Ostatnia aktywność
        </h2>
        {recentChanges.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">Brak zarejestrowanych zmian.</p>
        ) : (
          <ul className="space-y-2">
            {recentChanges.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 text-xs border-b border-border/40 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-foreground/90">
                  {labelFor(c.entityType)}
                  {c.field ? ` · ${c.field}` : ""}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {c.createdAt.toLocaleDateString("pl-PL", {
                    day: "2-digit",
                    month: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
