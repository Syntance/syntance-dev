import "server-only";
import { Resend } from "resend";
import { db } from "@/db";
import { changeHistory, kpis, projects } from "@/db/schema";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getProjectAlerts } from "@/lib/strategy-hub/alerts";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export interface DigestPayload {
  projectId: string;
  projectName: string;
  topChanges: { entityType: string; field: string | null; createdAt: Date }[];
  kpiSummary: { name: string; target: string | null; actual: string | null }[];
  alertCount: number;
  hubUrl: string;
}

export async function buildWeeklyDigest(projectId: string): Promise<DigestPayload | null> {
  const [project] = await db
    .select({ name: projects.name, slug: projects.slug })
    .from(projects)
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) return null;

  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [changes, kpiRows, alerts] = await Promise.all([
    db
      .select({
        entityType: changeHistory.entityType,
        field: changeHistory.field,
        createdAt: changeHistory.createdAt,
      })
      .from(changeHistory)
      .where(
        and(
          eq(changeHistory.projectId, projectId),
          gte(changeHistory.createdAt, weekAgo)
        )
      )
      .orderBy(desc(changeHistory.createdAt))
      .limit(3),
    db
      .select({ name: kpis.name, target: kpis.target, actual: kpis.actual })
      .from(kpis)
      .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)))
      .limit(5),
    getProjectAlerts(projectId),
  ]);

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://syntance.dev";

  return {
    projectId,
    projectName: project.name,
    topChanges: changes,
    kpiSummary: kpiRows,
    alertCount: alerts.length,
    hubUrl: `${base}/strategy-hub/projects/${projectId}`,
  };
}

export async function sendWeeklyDigest(
  toEmail: string,
  payload: DigestPayload
): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) {
    return { sent: false, reason: "RESEND_API_KEY not configured" };
  }

  const changesHtml =
    payload.topChanges.length === 0
      ? "<p>Brak zmian w ostatnim tygodniu.</p>"
      : `<ul>${payload.topChanges
          .map(
            (c) =>
              `<li>${c.entityType}${c.field ? `.${c.field}` : ""} — ${c.createdAt.toLocaleDateString("pl-PL")}</li>`
          )
          .join("")}</ul>`;

  const kpiHtml = payload.kpiSummary
    .map(
      (k) =>
        `<li><strong>${k.name}</strong>: ${k.actual ?? "—"} / ${k.target ?? "—"}</li>`
    )
    .join("");

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "Strategy Hub <hub@syntance.dev>",
    to: toEmail,
    subject: `Tygodniowy digest · ${payload.projectName}`,
    html: `
      <h1>${payload.projectName}</h1>
      <p>Top 3 zmiany (7 dni):</p>${changesHtml}
      <p>KPI:</p><ul>${kpiHtml}</ul>
      <p>Alerty aktywne: ${payload.alertCount}</p>
      <p><a href="${payload.hubUrl}">Otwórz Strategy Hub</a></p>
    `,
  });

  return { sent: true };
}
