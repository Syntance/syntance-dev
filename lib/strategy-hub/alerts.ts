import "server-only";
import { db } from "@/db";
import {
  kpis,
  changeHistory,
  clientVisitsLog,
  projects,
  projectClients,
  domains,
  notionSyncLog,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
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
  const kpiSince = new Date(Date.now() - rules.alerts.kpiBelowDays * 86400000);

  const kpiRows = await db
    .select()
    .from(kpis)
    .where(and(eq(kpis.projectId, projectId), isNull(kpis.deletedAt)));

  const belowThreshold = kpiRows
    .map((k) => {
      const target = parseKpiNumber(k.target);
      const actual = parseKpiNumber(k.actual);
      if (target === null || actual === null || target <= 0) return null;
      const pct = (actual / target) * 100;
      if (pct >= rules.alerts.kpiBelowPct) return null;
      return { kpi: k, actual, target, pct };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (belowThreshold.length > 0) {
    // Jedno zapytanie zamiast N+1: wszystkie zmiany w oknie dla kandydatów,
    // zredukowane do zbioru entityId z co najmniej jedną zmianą.
    const recentChangeRows = await db
      .select({ entityId: changeHistory.entityId })
      .from(changeHistory)
      .where(
        and(
          eq(changeHistory.projectId, projectId),
          eq(changeHistory.entityType, "kpi"),
          inArray(
            changeHistory.entityId,
            belowThreshold.map((b) => b.kpi.id)
          ),
          gte(changeHistory.createdAt, kpiSince)
        )
      );
    const recentlyChanged = new Set(recentChangeRows.map((r) => r.entityId));

    for (const { kpi: k, actual, target, pct } of belowThreshold) {
      if (!recentlyChanged.has(k.id)) continue;
      alerts.push({
        id: `kpi-${k.id}`,
        kind: "kpi",
        severity: pct < rules.alerts.kpiBelowPct * 0.5 ? "critical" : "warning",
        title: `KPI poniżej progu: ${k.name}`,
        message: `${actual}${k.unit ? ` ${k.unit}` : ""} vs cel ${target} (${Math.round(pct)}%)`,
      });
    }
  }

  // Domena: alert tylko gdy jest realna data wygaśnięcia w oknie progu —
  // bez tego był placeholder WHOIS zawsze-włączony (audyt 2026-07).
  const expiringDomains = await db
    .select({ name: domains.name, expiresAt: domains.expiresAt })
    .from(domains)
    .where(eq(domains.projectId, projectId));

  const domainWindowMs = rules.alerts.domainExpiringDays * 86400000;
  for (const d of expiringDomains) {
    if (!d.expiresAt) continue;
    const msLeft = d.expiresAt.getTime() - Date.now();
    if (msLeft > domainWindowMs) continue;
    const daysLeft = Math.max(0, Math.ceil(msLeft / 86400000));
    alerts.push({
      id: `domain-${d.name}`,
      kind: "domain",
      severity: daysLeft <= 7 ? "critical" : "warning",
      title: "Domena wkrótce wygasa",
      message: `${d.name} wygasa za ${daysLeft} dni.`,
    });
  }

  // Wizyty: tylko dla projektów z podpiętym klientem, starszych niż okno —
  // świeży projekt bez klienta nie powinien od razu straszyć alertem (audyt 2026-07).
  const [project] = await db
    .select({ createdAt: projects.createdAt })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const visitSince = new Date(Date.now() - rules.alerts.visitDays * 86400000);
  const projectOlderThanWindow = !!project && project.createdAt < visitSince;

  if (projectOlderThanWindow) {
    const [clientCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectClients)
      .where(eq(projectClients.projectId, projectId));

    if ((clientCount?.count ?? 0) > 0) {
      const [visitCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(clientVisitsLog)
        .where(
          and(
            eq(clientVisitsLog.projectId, projectId),
            gte(clientVisitsLog.viewedAt, visitSince)
          )
        );

      if ((visitCount?.count ?? 0) === 0) {
        alerts.push({
          id: "visit-none",
          kind: "visit",
          severity: "warning",
          title: "Brak wizyt klienta",
          message: `Klient nie otworzył dashboardu w ostatnich ${rules.alerts.visitDays} dniach.`,
        });
      }
    }
  }

  // Sync: ostatnie N wpisów logu ma status error → prawdopodobnie zepsuta integracja.
  const recentSyncRows = await db
    .select({ status: notionSyncLog.status })
    .from(notionSyncLog)
    .where(eq(notionSyncLog.projectId, projectId))
    .orderBy(desc(notionSyncLog.syncedAt))
    .limit(rules.alerts.syncFailThreshold);

  if (
    recentSyncRows.length >= rules.alerts.syncFailThreshold &&
    recentSyncRows.every((r) => r.status === "error")
  ) {
    alerts.push({
      id: "sync-failing",
      kind: "sync",
      severity: "critical",
      title: "Synchronizacja Notion nie działa",
      message: `Ostatnie ${recentSyncRows.length} prób synchronizacji zakończyło się błędem.`,
    });
  }

  return alerts;
}
