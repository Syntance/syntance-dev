import { redirect, notFound } from "next/navigation";
import { getClientSession } from "@/lib/auth";
import { getProjectBySlugForUser } from "@/lib/client-portal/queries";
import { db } from "@/db";
import { projects as dbProjects, siteAudits, siteAuditFindings } from "@/db/schema";
import { eq, isNull, and, desc, inArray } from "drizzle-orm";
import { ShieldCheck, Hammer, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackVisit } from "@/lib/strategy-hub/tracking";
import {
  getProjectVisibility,
  moduleStatus,
  type VisibilityStatus,
} from "@/lib/strategy-hub/visibility";

interface Props {
  params: Promise<{ slug: string }>;
}

type Audit = typeof siteAudits.$inferSelect;
type Finding = typeof siteAuditFindings.$inferSelect;

async function getAudits(slug: string): Promise<{
  moduleVis: VisibilityStatus;
  audits: (Audit & { findings: Finding[] })[];
}> {
  try {
    const rows = await db
      .select({ id: dbProjects.id })
      .from(dbProjects)
      .where(and(eq(dbProjects.slug, slug), isNull(dbProjects.deletedAt)))
      .limit(1);

    if (!rows[0]) return { moduleVis: "visible", audits: [] };

    const projectId = rows[0].id;
    trackVisit(projectId, "audit");

    const [auditRows, vis] = await Promise.all([
      db
        .select()
        .from(siteAudits)
        .where(and(eq(siteAudits.projectId, projectId), isNull(siteAudits.deletedAt)))
        .orderBy(desc(siteAudits.date))
        .limit(10),
      getProjectVisibility(projectId),
    ]);

    const auditIds = auditRows.map((a) => a.id);
    const findingRows = auditIds.length
      ? await db
          .select()
          .from(siteAuditFindings)
          .where(
            and(inArray(siteAuditFindings.auditId, auditIds), isNull(siteAuditFindings.deletedAt))
          )
          .orderBy(siteAuditFindings.orderIdx)
      : [];

    const audits = auditRows.map((a) => ({
      ...a,
      findings: findingRows.filter((f) => f.auditId === a.id),
    }));

    return { moduleVis: moduleStatus(vis, "audit"), audits };
  } catch {
    return { moduleVis: "visible", audits: [] };
  }
}

const SEVERITY: Record<string, { label: string; icon: typeof Info; className: string }> = {
  high: { label: "Wysoki", icon: AlertCircle, className: "bg-destructive/15 text-destructive border-destructive/30" },
  medium: { label: "Średni", icon: AlertTriangle, className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  low: { label: "Niski", icon: Info, className: "bg-muted text-muted-foreground border-border" },
};

export default async function ClientAuditPage({ params }: Props) {
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

  const { moduleVis, audits } = await getAudits(slug);
  if (moduleVis === "hidden") notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="size-5 text-brand" />
          <h1 className="text-xl font-semibold tracking-tight">Audyt strony</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Ustalenia z audytów technicznych i UX Twojej strony.
        </p>
      </div>

      {moduleVis === "in_progress" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 py-16 text-center">
          <Hammer className="mx-auto size-10 text-amber-500/50 mb-3" />
          <p className="text-sm text-foreground/90">Ta sekcja jest w budowie.</p>
        </div>
      ) : audits.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 py-16 text-center">
          <ShieldCheck className="mx-auto size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            Nie przeprowadzono jeszcze audytu tej strony.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {audits.map((audit) => (
            <div key={audit.id} className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-medium text-sm capitalize">{audit.type ?? "Audyt"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {new Date(audit.date).toLocaleDateString("pl-PL")}
                  </p>
                </div>
                <div className="flex gap-1.5 text-[10px] font-medium">
                  {audit.severityHigh ? (
                    <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5">
                      {audit.severityHigh} wysoki
                    </span>
                  ) : null}
                  {audit.severityMedium ? (
                    <span className="rounded-full bg-amber-500/15 text-amber-500 px-2 py-0.5">
                      {audit.severityMedium} średni
                    </span>
                  ) : null}
                  {audit.severityLow ? (
                    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                      {audit.severityLow} niski
                    </span>
                  ) : null}
                </div>
              </div>

              {audit.summaryMd && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-4">
                  {audit.summaryMd}
                </p>
              )}

              {audit.findings.length > 0 && (
                <ul className="space-y-2">
                  {audit.findings.map((f) => {
                    const sev = SEVERITY[f.severity] ?? SEVERITY.low;
                    return (
                      <li
                        key={f.id}
                        className={cn(
                          "rounded-lg border p-3 text-sm",
                          sev.className
                        )}
                      >
                        <div className="flex items-center gap-1.5 font-medium mb-1">
                          <sev.icon className="size-3.5" />
                          {sev.label}
                          {f.area && <span className="font-normal opacity-70">· {f.area}</span>}
                        </div>
                        <p className="text-foreground/90">{f.findingMd}</p>
                        {f.recommendationMd && (
                          <p className="mt-1 text-xs opacity-80">Rekomendacja: {f.recommendationMd}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
