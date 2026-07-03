import "server-only";
import { db } from "@/db";
import {
  brandIdentity,
  brandVisual,
  brandPositioning,
  segments,
  purchaseStages,
  funnelElements,
  channels,
  channelActivityPlan,
  salesPitches,
  salesScripts,
  leadMagnets,
  kpis,
  pages,
  siteAudits,
  siteAuditFindings,
  notionSyncLog,
  projectQuestions,
  projectTasks,
  aiActionsLog,
} from "@/db/schema";
import { and, count, desc, eq, isNull, inArray } from "drizzle-orm";

interface CanvasColor {
  name?: string;
  value: string;
  role?: string;
}

interface CanvasSegment {
  id: string;
  name: string;
  personaName: string | null;
  revenueSharePct: number | null;
  priority: number | null;
  status: string | null;
}

interface CanvasKpi {
  id: string;
  name: string;
  target: string | null;
  actual: string | null;
  unit: string | null;
}

interface CanvasCompetitor {
  label: string;
  x: number;
  y: number;
}

export interface CanvasData {
  brand: {
    missionMd: string | null;
    toneOfVoiceMd: string | null;
    colors: CanvasColor[];
  };
  positioning: {
    ourX: number | null;
    ourY: number | null;
    ourLabel: string | null;
    competitors: CanvasCompetitor[];
  };
  segments: { items: CanvasSegment[]; total: number };
  funnel: { stages: number; elements: number };
  channels: { total: number; activities: number };
  materials: { pitches: number; scripts: number; leadMagnets: number };
  kpis: { items: CanvasKpi[]; total: number };
  website: { pages: number };
  audit: { high: number; medium: number; low: number; findings: number };
  sync: { lastSyncedAt: Date | null };
  discovery: { openQuestions: number; openTasks: number };
  ai: { recent: number };
}

function asColors(v: unknown): CanvasColor[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is CanvasColor =>
      Boolean(c && typeof c === "object" && "value" in c)
    )
    .slice(0, 6);
}

function asCompetitors(v: unknown): CanvasCompetitor[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (c): c is CanvasCompetitor =>
      Boolean(
        c &&
          typeof c === "object" &&
          typeof (c as CanvasCompetitor).x === "number" &&
          typeof (c as CanvasCompetitor).y === "number"
      )
  );
}

/** Pobiera wszystkie dane potrzebne do 12 kafelków Strategy Canvas. */
export async function getCanvasData(projectId: string): Promise<CanvasData> {
  const pid = projectId;

  const [
    identity,
    visual,
    positioning,
    segItems,
    [stageCount],
    [elementCount],
    [chCount],
    [activityCount],
    [pitchCount],
    [scriptCount],
    [leadMagnetCount],
    kpiItems,
    [kpiCount],
    [pageCount],
    auditFindings,
    [lastSync],
    [openQ],
    [openT],
    [aiRecent],
  ] = await Promise.all([
    db
      .select({ missionMd: brandIdentity.missionMd, toneOfVoiceMd: brandIdentity.toneOfVoiceMd })
      .from(brandIdentity)
      .where(eq(brandIdentity.projectId, pid))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({ colors: brandVisual.colors })
      .from(brandVisual)
      .where(eq(brandVisual.projectId, pid))
      .limit(1)
      .then((r) => r[0]),
    db
      .select()
      .from(brandPositioning)
      .where(eq(brandPositioning.projectId, pid))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        id: segments.id,
        name: segments.name,
        personaName: segments.personaName,
        revenueSharePct: segments.revenueSharePct,
        priority: segments.priority,
        status: segments.status,
      })
      .from(segments)
      .where(and(eq(segments.projectId, pid), isNull(segments.deletedAt)))
      .orderBy(desc(segments.revenueSharePct))
      .limit(20),
    db
      .select({ count: count() })
      .from(purchaseStages)
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(
          eq(segments.projectId, pid),
          isNull(segments.deletedAt),
          isNull(purchaseStages.deletedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(funnelElements)
      .innerJoin(purchaseStages, eq(funnelElements.stageId, purchaseStages.id))
      .innerJoin(segments, eq(purchaseStages.segmentId, segments.id))
      .where(
        and(
          eq(segments.projectId, pid),
          isNull(segments.deletedAt),
          isNull(funnelElements.deletedAt)
        )
      ),
    db
      .select({ count: count() })
      .from(channels)
      .where(and(eq(channels.projectId, pid), isNull(channels.deletedAt))),
    db
      .select({ count: count() })
      .from(channelActivityPlan)
      .innerJoin(channels, eq(channelActivityPlan.channelId, channels.id))
      .where(and(eq(channels.projectId, pid), isNull(channelActivityPlan.deletedAt))),
    db
      .select({ count: count() })
      .from(salesPitches)
      .where(and(eq(salesPitches.projectId, pid), isNull(salesPitches.deletedAt))),
    db
      .select({ count: count() })
      .from(salesScripts)
      .where(and(eq(salesScripts.projectId, pid), isNull(salesScripts.deletedAt))),
    db
      .select({ count: count() })
      .from(leadMagnets)
      .where(and(eq(leadMagnets.projectId, pid), isNull(leadMagnets.deletedAt))),
    db
      .select({
        id: kpis.id,
        name: kpis.name,
        target: kpis.target,
        actual: kpis.actual,
        unit: kpis.unit,
      })
      .from(kpis)
      .where(and(eq(kpis.projectId, pid), isNull(kpis.deletedAt)))
      .limit(4),
    db
      .select({ count: count() })
      .from(kpis)
      .where(and(eq(kpis.projectId, pid), isNull(kpis.deletedAt))),
    db
      .select({ count: count() })
      .from(pages)
      .where(and(eq(pages.projectId, pid), isNull(pages.deletedAt))),
    db
      .select({ severity: siteAuditFindings.severity })
      .from(siteAuditFindings)
      .innerJoin(siteAudits, eq(siteAuditFindings.auditId, siteAudits.id))
      .where(and(eq(siteAudits.projectId, pid), isNull(siteAuditFindings.deletedAt))),
    db
      .select({ syncedAt: notionSyncLog.syncedAt })
      .from(notionSyncLog)
      .where(eq(notionSyncLog.projectId, pid))
      .orderBy(desc(notionSyncLog.syncedAt))
      .limit(1),
    db
      .select({ count: count() })
      .from(projectQuestions)
      .where(
        and(
          eq(projectQuestions.projectId, pid),
          isNull(projectQuestions.deletedAt),
          eq(projectQuestions.status, "open")
        )
      ),
    db
      .select({ count: count() })
      .from(projectTasks)
      .where(
        and(
          eq(projectTasks.projectId, pid),
          isNull(projectTasks.deletedAt),
          inArray(projectTasks.status, ["todo", "in_progress"])
        )
      ),
    db
      .select({ count: count() })
      .from(aiActionsLog)
      .where(eq(aiActionsLog.projectId, pid)),
  ]);

  const high = auditFindings.filter((f) => f.severity === "high").length;
  const medium = auditFindings.filter((f) => f.severity === "medium").length;
  const low = auditFindings.filter((f) => f.severity === "low").length;

  return {
    brand: {
      missionMd: identity?.missionMd ?? null,
      toneOfVoiceMd: identity?.toneOfVoiceMd ?? null,
      colors: asColors(visual?.colors),
    },
    positioning: {
      ourX: positioning?.ourX ?? null,
      ourY: positioning?.ourY ?? null,
      ourLabel: positioning?.ourLabel ?? null,
      competitors: asCompetitors(positioning?.competitorsOnQuadrant),
    },
    segments: { items: segItems.slice(0, 3), total: segItems.length },
    funnel: { stages: stageCount?.count ?? 0, elements: elementCount?.count ?? 0 },
    channels: { total: chCount?.count ?? 0, activities: activityCount?.count ?? 0 },
    materials: {
      pitches: pitchCount?.count ?? 0,
      scripts: scriptCount?.count ?? 0,
      leadMagnets: leadMagnetCount?.count ?? 0,
    },
    kpis: { items: kpiItems, total: kpiCount?.count ?? 0 },
    website: { pages: pageCount?.count ?? 0 },
    audit: { high, medium, low, findings: auditFindings.length },
    sync: { lastSyncedAt: lastSync?.syncedAt ?? null },
    discovery: { openQuestions: openQ?.count ?? 0, openTasks: openT?.count ?? 0 },
    ai: { recent: aiRecent?.count ?? 0 },
  };
}
