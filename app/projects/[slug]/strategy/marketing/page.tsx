import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { db } from "@/db";
import {
  projects as dbProjects,
  segments,
  kpis,
  userFlows,
} from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { BarChart3, Users, Target, GitBranch } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getMarketingData(slug: string) {
  const rows = await db
    .select({ id: dbProjects.id })
    .from(dbProjects)
    .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
    .limit(1);

  if (!rows[0]) return null;

  const projectId = rows[0].id;
  const [segmentList, kpiList, flowList] = await Promise.all([
    db
      .select()
      .from(segments)
      .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt))),
    db
      .select()
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt))),
    db
      .select()
      .from(userFlows)
      .where(
        and(eq(userFlows.projectId, projectId), isNull(userFlows.deletedAt))
      ),
  ]);

  return { projectId, segmentList, kpiList, flowList };
}

export default async function ClientMarketingPage({ params }: Props) {
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

  const data = await getMarketingData(slug);
  if (data) trackVisit(data.projectId, "marketing");

  const hasContent =
    data &&
    (data.segmentList.length > 0 ||
      data.kpiList.length > 0 ||
      data.flowList.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">
            Strategia marketingowa
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Segmenty docelowe, kluczowe wskaźniki i ścieżki użytkownika.
        </p>
      </div>

      {!hasContent ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <BarChart3 className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Strategia marketingowa jest opracowywana.
          </p>
        </div>
      ) : (
        <>
          {data!.segmentList.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-muted-foreground" />
                <h2 className="font-medium text-sm">
                  Segmenty docelowe ({data!.segmentList.length})
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {data!.segmentList.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <h3 className="font-semibold text-sm">{s.name}</h3>
                    {s.persona && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {s.persona}
                      </p>
                    )}
                    {s.jtbd && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          Jobs To Be Done
                        </span>
                        <p className="text-xs text-foreground/90 mt-1">
                          {s.jtbd}
                        </p>
                      </div>
                    )}
                    {s.uvpText && (
                      <div className="mt-2">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          UVP
                        </span>
                        <p className="text-xs text-foreground/90 mt-1">
                          {s.uvpText}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {data!.kpiList.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-muted-foreground" />
                <h2 className="font-medium text-sm">
                  KPI ({data!.kpiList.length})
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {data!.kpiList.map((k) => (
                  <div
                    key={k.id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">
                      {k.category ?? "KPI"}
                    </div>
                    <div className="font-medium text-sm mt-1">{k.name}</div>
                    <div className="mt-2 font-mono text-lg">
                      {k.actual ?? "—"}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        / {k.target ?? "—"} {k.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {data!.flowList.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <GitBranch className="size-4 text-muted-foreground" />
                <h2 className="font-medium text-sm">
                  User flows ({data!.flowList.length})
                </h2>
              </div>
              <div className="space-y-2">
                {data!.flowList.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{f.name}</span>
                      {f.type && (
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {f.type}
                        </span>
                      )}
                    </div>
                    {f.conversionGoal && (
                      <div className="text-xs text-muted-foreground mt-1.5">
                        Cel: <span className="text-foreground/90">{f.conversionGoal}</span>
                      </div>
                    )}
                    {f.stepsMd && (
                      <pre className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">
                        {f.stepsMd}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
