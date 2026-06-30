import "server-only";
import { db } from "@/db";
import {
  kpis,
  changeHistory,
  clientVisitsLog,
  projects,
} from "@/db/schema";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { resolveRules } from "@/lib/strategy-hub/rules/resolve";

export interface ProjectAlert {
  id: string;
  kind: "kpi" | "domain" | "sync" | "visit";
  severity: "warning" | "critical";
  title: string;
  message: string;
}

function parseKpiNumber(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Alerty projektu wg progów z rules.alerts. */
export async function getProjectAlerts(projectId: string): Promise<ProjectAlert[]> {
  const rules = await resolveRules(projectId);
  const alerts: ProjectAlert[] = [];
  const since = new Date(Date.now() - rules.alerts.kpiBelowDays * 86400000);

  const kpiRows = await db
    .select()
    .from(kpis)
    .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)));

  for (const k of kpiRows) {
    const target = parseKpiNumber(k.target);
    const actual = parseKpiNumber(k.actual);
    if (target === null || actual === null || target <= 0) continue;
    const pct = (actual / target) * 100;
    if (pct >= rules.alerts.kpiBelowPct) continue;

    const [recentChange] = await db
      .select({ createdAt: changeHistory.createdAt })
      .from(changeHistory)
      .where(
        and(
          eq(changeHistory.projectId, projectId),
          eq(changeHistory.entityType, "kpi"),
          eq(changeHistory.entityId, k.id),
          gte(changeHistory.createdAt, since)
        )
      )
      .orderBy(desc(changeHistory.createdAt))
      .limit(1);

    if (!recentChange) continue;

    alerts.push({
      id: `kpi-${k.id}`,
      kind: "kpi",
      severity: pct < rules.alerts.kpiBelowPct * 0.5 ? "critical" : "warning",
      title: `KPI poniżej progu: ${k.name}`,
      message: `${actual}${k.unit ? ` ${k.unit}` : ""} vs cel ${target} (${Math.round(pct)}%)`,
    });
  }

  const [project] = await db
    .select({ domain: projects.domain })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  if (project?.domain) {
    alerts.push({
      id: "domain-check",
      kind: "domain",
      severity: "warning",
      title: "Sprawdź ważność domeny",
      message: `${project.domain} — próg alertu: ${rules.alerts.domainExpiringDays} dni (integracja WHOIS: placeholder).`,
    });
  }

  const [visitCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clientVisitsLog)
    .where(
      and(
        eq(clientVisitsLog.projectId, projectId),
        gte(clientVisitsLog.viewedAt, since)
      )
    );

  if ((visitCount?.count ?? 0) === 0) {
    alerts.push({
      id: "visit-none",
      kind: "visit",
      severity: "warning",
      title: "Brak wizyt klienta",
      message: "Klient nie otworzył dashboardu w ostatnich 7 dniach.",
    });
  }

  return alerts;
}
