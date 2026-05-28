import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/sanity/queries";
import { db } from "@/db";
import { projects as dbProjects, segments } from "@/db/schema";
import { eq, isNull, and, asc } from "drizzle-orm";
import { Users, Target, AlertCircle, Sparkles, Hammer } from "lucide-react";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
  recordStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

type SegmentRow = typeof segments.$inferSelect & { _vis: VisibilityStatus };

async function getSegments(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  rows: SegmentRow[];
}> {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);
    if (!rows[0]) return { moduleVis: "visible", rows: [] };

    const projectId = rows[0].id;
    trackVisit(projectId, "segments");

    const [all, vis] = await Promise.all([
      db
        .select()
        .from(segments)
        .where(and(eq(segments.projectId, projectId), isNull(segments.deletedAt)))
        .orderBy(asc(segments.orderIdx), asc(segments.name)),
      getProjectVisibility(projectId),
    ]);

    const visible = all
      .map((s) => ({ ...s, _vis: recordStatus(vis, "segments", s.id) }))
      .filter((s) => s._vis !== "hidden");

    return { moduleVis: moduleStatus(vis, "segments"), rows: visible };
  } catch {
    return { moduleVis: "visible", rows: [] };
  }
}

function Field({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5 text-brand" />
        {label}
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

export default async function ClientSegmentsPage({ params }: Props) {
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

  const { moduleVis, rows } = await getSegments(slug);

  if (moduleVis === "hidden") notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Segmenty</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Grupy docelowe Twojego projektu — persona, potrzeby i propozycja
          wartości dla każdej z nich.
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
          <Users className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Segmenty są jeszcze opracowywane.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Wróć tutaj, gdy Syntance je uzupełni.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-border bg-card p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
                    {s.icon ?? "👤"}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-medium text-sm truncate">
                      {s.name}
                      {s.personaName ? ` · ${s.personaName}` : ""}
                    </h2>
                    {s.code && (
                      <p className="text-xs text-muted-foreground font-mono">
                        {s.code}
                      </p>
                    )}
                  </div>
                </div>
                {s._vis === "in_progress" ? (
                  <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                    <Hammer className="size-3" /> w budowie
                  </span>
                ) : (
                  typeof s.revenueSharePct === "number" && (
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {s.revenueSharePct}% przychodu
                    </span>
                  )
                )}
              </div>

              {s._vis !== "in_progress" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    icon={Target}
                    label="Zadanie do wykonania (JTBD)"
                    value={s.jtbdMd ?? s.jtbd}
                  />
                  <Field
                    icon={AlertCircle}
                    label="Problem"
                    value={s.problemMd ?? s.problem}
                  />
                  <Field
                    icon={Sparkles}
                    label="Propozycja wartości"
                    value={s.uvpForSegmentMd ?? s.uvpText}
                  />
                  <Field
                    icon={Users}
                    label="Charakterystyka"
                    value={s.demographicsMd ?? s.persona}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
