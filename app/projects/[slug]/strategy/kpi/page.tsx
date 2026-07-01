import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import {
  projects as dbProjects,
  kpis,
  kpiSnapshots,
} from "@/db/schema";
import { eq, isNull, and, asc, inArray } from "drizzle-orm";
import { Gauge, Hammer } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import { Sparkline } from "@/components/strategy-hub/sparkline";
import {
  getProjectVisibility,
  moduleStatus,
  recordStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

interface KpiView {
  id: string;
  name: string;
  target: string | null;
  actual: string | null;
  unit: string | null;
  category: string | null;
  series: number[];
  vis: VisibilityStatus;
}

function parseNum(v: string | null | undefined): number | null {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function getKpis(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  rows: KpiView[];
}> {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);
    if (!rows[0]) return { moduleVis: "visible", rows: [] };

    const projectId = rows[0].id;
    trackVisit(projectId, "kpi");

    const [kpiRows, vis] = await Promise.all([
      db
        .select()
        .from(kpis)
        .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)))
        .orderBy(asc(kpis.category), asc(kpis.name)),
      getProjectVisibility(projectId),
    ]);

    const moduleVis = moduleStatus(vis, "kpi");
    if (kpiRows.length === 0) return { moduleVis, rows: [] };

    const snaps = await db
      .select()
      .from(kpiSnapshots)
      .where(
        and(
          inArray(
            kpiSnapshots.kpiId,
            kpiRows.map((k) => k.id)
          ),
          isNull(kpiSnapshots.deletedAt)
        )
      )
      .orderBy(asc(kpiSnapshots.recordedAt));

    const result = kpiRows
      .map((k) => ({
        id: k.id,
        name: k.name,
        target: k.target,
        actual: k.actual,
        unit: k.unit,
        category: k.category,
        series: snaps
          .filter((s) => s.kpiId === k.id)
          .map((s) => parseNum(s.value))
          .filter((n): n is number => n != null),
        vis: recordStatus(vis, "kpis", k.id),
      }))
      .filter((k) => k.vis !== "hidden");

    return { moduleVis, rows: result };
  } catch {
    return { moduleVis: "visible", rows: [] };
  }
}

export default async function ClientKpiPage({ params }: Props) {
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

  const { moduleVis, rows } = await getKpis(slug);
  if (moduleVis === "hidden") notFound();
  const categories = Array.from(
    new Set(rows.map((k) => k.category ?? "Pozostałe"))
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Gauge className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">KPI</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Mierzalne cele projektu i ich bieżący postęp.
        </p>
      </div>

      {moduleVis === "in_progress" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-16 text-center">
          <Hammer className="mx-auto size-10 text-amber-500/50 mb-3" />
          <p className="text-sm text-foreground/90">Ta sekcja jest w budowie.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Pracujemy nad nią — wróć wkrótce.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <Gauge className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            KPI są jeszcze opracowywane.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Wróć tutaj, gdy Syntance je uzupełni.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <section key={cat} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {rows
                  .filter((k) => (k.category ?? "Pozostałe") === cat)
                  .map((k) => {
                    const target = parseNum(k.target);
                    const actual = parseNum(k.actual);
                    const progress =
                      target != null && actual != null && target !== 0
                        ? Math.max(0, Math.min(1, actual / target))
                        : null;
                    const wip = k.vis === "in_progress";
                    return (
                      <div
                        key={k.id}
                        className="rounded-xl border border-border bg-card p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium">{k.name}</h3>
                          {wip ? (
                            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                              <Hammer className="size-3" /> w budowie
                            </span>
                          ) : (
                            <Sparkline values={k.series} className="shrink-0" />
                          )}
                        </div>
                        {!wip && (
                          <>
                            <div className="flex items-baseline gap-2">
                              <span className="text-xl font-semibold tabular-nums">
                                {k.actual ?? "—"}
                              </span>
                              {k.unit && (
                                <span className="text-xs text-muted-foreground">
                                  {k.unit}
                                </span>
                              )}
                              {k.target && (
                                <span className="ml-auto text-xs text-muted-foreground">
                                  cel: {k.target}
                                  {k.unit ? ` ${k.unit}` : ""}
                                </span>
                              )}
                            </div>
                            {progress != null && (
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-brand"
                                  style={{ width: `${(progress * 100).toFixed(0)}%` }}
                                />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
