import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { projects as dbProjects, campaigns } from "@/db/schema";
import { eq, isNull, and, desc } from "drizzle-orm";
import { Megaphone, Hammer, Calendar } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

type CampaignRow = typeof campaigns.$inferSelect;

const STAGE_LABEL: Record<string, string> = {
  TOFU: "TOFU",
  MOFU: "MOFU",
  BOFU: "BOFU",
  retention: "Retencja",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  planned: { label: "Zaplanowana", color: "bg-muted text-muted-foreground" },
  active: { label: "Aktywna", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  paused: { label: "Wstrzymana", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  completed: { label: "Zakończona", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
};

function formatDate(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
}

async function getCampaignsData(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  rows: CampaignRow[];
}> {
  try {
    const [p] = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);
    if (!p) return { moduleVis: "visible", rows: [] };

    trackVisit(p.id, "campaigns");

    const [rows, vis] = await Promise.all([
      db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.projectId, p.id), isNull(campaigns.deletedAt)))
        .orderBy(desc(campaigns.periodStart)),
      getProjectVisibility(p.id),
    ]);

    // Kampanie nie mają własnego modułu w silniku reguł — dzielą widoczność
    // z "marketing" (macierz zależności: Kampania wymaga Elementy+Segment+Kanały+Oferta).
    return { moduleVis: moduleStatus(vis, "marketing"), rows };
  } catch {
    return { moduleVis: "visible", rows: [] };
  }
}

export default async function ClientCampaignsPage({ params }: Props) {
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

  const { moduleVis, rows } = await getCampaignsData(slug);
  if (moduleVis === "hidden") notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Megaphone className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Kampanie</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Aktywne i planowane kampanie marketingowe wraz z budżetem i harmonogramem.
        </p>
      </div>

      {moduleVis === "in_progress" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-500">
          <Hammer className="size-4 shrink-0" />
          Ten moduł jest jeszcze w budowie — zawartość może się zmienić.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Megaphone className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Brak kampanii do wyświetlenia.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {rows.map((c) => {
            const statusMeta = STATUS_META[c.status ?? "planned"] ?? STATUS_META.planned;
            const start = formatDate(c.periodStart);
            const end = formatDate(c.periodEnd);
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                    {c.goal && (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.goal}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border ${statusMeta.color}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {c.stage && (
                    <span className="px-2 py-0.5 rounded-md bg-muted">
                      {STAGE_LABEL[c.stage] ?? c.stage}
                    </span>
                  )}
                  {(start || end) && (
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      {start ?? "?"} – {end ?? "?"}
                    </span>
                  )}
                  {c.budgetPlan != null && (
                    <span>Budżet: {c.budgetPlan.toLocaleString("pl-PL")} zł</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
