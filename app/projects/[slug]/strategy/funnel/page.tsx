import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import {
  projects as dbProjects,
  funnelElements,
  purchaseStages,
  segments,
} from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { Milestone, Hammer, Target } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

interface FunnelElementView {
  id: string;
  name: string;
  format: string | null;
  cta: string | null;
  stageName: string;
  stagePhase: string;
  segmentName: string;
}

const PHASE_ORDER = ["TOFU", "MOFU", "BOFU", "retention"] as const;

const PHASE_META: Record<string, { label: string; color: string }> = {
  TOFU: { label: "TOFU — Świadomość", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  MOFU: { label: "MOFU — Rozważanie", color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  BOFU: { label: "BOFU — Decyzja", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  retention: { label: "Retencja", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

async function getFunnelData(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  rows: FunnelElementView[];
}> {
  try {
    const [p] = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);
    if (!p) return { moduleVis: "visible", rows: [] };

    trackVisit(p.id, "funnel");

    const [rows, vis] = await Promise.all([
      db
        .select({
          id: funnelElements.id,
          name: funnelElements.name,
          format: funnelElements.format,
          cta: funnelElements.cta,
          stageName: purchaseStages.name,
          stagePhase: purchaseStages.phase,
          segmentName: segments.name,
        })
        .from(funnelElements)
        .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
        .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
        .where(
          and(eq(segments.projectId, p.id), isNull(funnelElements.deletedAt))
        )
        .orderBy(asc(funnelElements.position)),
      getProjectVisibility(p.id),
    ]);

    return {
      moduleVis: moduleStatus(vis, "funnel"),
      rows: rows.map((r) => ({
        ...r,
        stagePhase: r.stagePhase ?? "TOFU",
      })),
    };
  } catch {
    return { moduleVis: "visible", rows: [] };
  }
}

export default async function ClientFunnelPage({ params }: Props) {
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

  const { moduleVis, rows } = await getFunnelData(slug);
  if (moduleVis === "hidden") notFound();

  const grouped = PHASE_ORDER.map((phase) => ({
    phase,
    meta: PHASE_META[phase],
    items: rows.filter((r) => r.stagePhase === phase),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Milestone className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Lejek sprzedażowy</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Treści i punkty styku klienta na drodze od świadomości do decyzji zakupowej.
        </p>
      </div>

      {moduleVis === "in_progress" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-500">
          <Hammer className="size-4 shrink-0" />
          Ten moduł jest jeszcze w budowie — zawartość może się zmienić.
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Target className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Lejek sprzedażowy jest w trakcie przygotowania.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) => (
            <section key={g.phase} className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full border ${g.meta.color}`}
                >
                  {g.meta.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {g.items.length} {g.items.length === 1 ? "element" : "elementów"}
                </span>
              </div>
              <div className="grid gap-2">
                {g.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-border bg-card p-4 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.stageName} · {item.segmentName}
                        {item.format ? ` · ${item.format}` : ""}
                      </p>
                    </div>
                    {item.cta && (
                      <span className="shrink-0 text-xs font-medium text-brand bg-brand/10 px-2 py-1 rounded-md">
                        {item.cta}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
