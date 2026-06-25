import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import {
  requireApiAccess,
  requireProjectAccess,
} from "@/lib/strategy-hub/api-helpers";
import { getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";
import {
  computeDurationMinutes,
  isWorkType,
  WORK_TYPES,
  type SummaryResult,
  type WorkType,
  type WorkTypeSummary,
  toDateKey,
  toMonthKey,
} from "@/lib/strategy-hub/time-tracking";
import { and, eq, gte, isNull, lte } from "drizzle-orm";

function emptyWorkTypeMap(): Record<WorkType, { minutes: number; entries: number; rateSum: number; rateMinutes: number }> {
  return {
    development: { minutes: 0, entries: 0, rateSum: 0, rateMinutes: 0 },
    maintenance: { minutes: 0, entries: 0, rateSum: 0, rateMinutes: 0 },
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = toParam ? new Date(toParam) : now;
  to.setHours(23, 59, 59, 999);

  if (projectId) {
    const projectAuth = await requireProjectAccess(projectId);
    if (!projectAuth.ok) return projectAuth.response;
  }

  const ws = await getOrCreateWorkspaceForAdmin(auth.access.session.email);

  const conditions = [
    isNull(timeEntries.deletedAt),
    eq(projects.workspaceId, ws.id),
    gte(timeEntries.startedAt, from),
    lte(timeEntries.startedAt, to),
  ];

  if (projectId) {
    conditions.push(eq(timeEntries.projectId, projectId));
  }

  const rows = await db
    .select({
      startedAt: timeEntries.startedAt,
      endedAt: timeEntries.endedAt,
      durationMinutes: timeEntries.durationMinutes,
      workType: timeEntries.workType,
      hourlyRate: projects.hourlyRate,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(...conditions));

  let totalMinutes = 0;
  const byDayMap = new Map<string, { minutes: number; entries: number }>();
  const byMonthMap = new Map<string, { minutes: number; entries: number }>();
  const byWorkTypeMap = emptyWorkTypeMap();
  let weightedRateSum = 0;
  let weightedMinutes = 0;

  for (const row of rows) {
    const minutes =
      row.durationMinutes ??
      (row.endedAt
        ? computeDurationMinutes(row.startedAt, row.endedAt)
        : computeDurationMinutes(row.startedAt, now));

    totalMinutes += minutes;

    const dayKey = toDateKey(row.startedAt);
    const day = byDayMap.get(dayKey) ?? { minutes: 0, entries: 0 };
    day.minutes += minutes;
    day.entries += 1;
    byDayMap.set(dayKey, day);

    const monthKey = toMonthKey(row.startedAt);
    const month = byMonthMap.get(monthKey) ?? { minutes: 0, entries: 0 };
    month.minutes += minutes;
    month.entries += 1;
    byMonthMap.set(monthKey, month);

    const wt: WorkType = isWorkType(row.workType) ? row.workType : "development";
    const wtBucket = byWorkTypeMap[wt];
    wtBucket.minutes += minutes;
    wtBucket.entries += 1;
    if (row.hourlyRate != null && minutes > 0) {
      wtBucket.rateSum += row.hourlyRate * minutes;
      wtBucket.rateMinutes += minutes;
    }

    if (row.hourlyRate != null && minutes > 0) {
      weightedRateSum += row.hourlyRate * minutes;
      weightedMinutes += minutes;
    }
  }

  const hourlyRate =
    projectId && rows[0]?.hourlyRate != null
      ? rows[0].hourlyRate
      : weightedMinutes > 0
        ? weightedRateSum / weightedMinutes
        : null;

  const totalAmount =
    hourlyRate != null ? (totalMinutes / 60) * hourlyRate : null;

  const byWorkType: WorkTypeSummary[] = WORK_TYPES.map((workType) => {
    const bucket = byWorkTypeMap[workType];
    const typeRate =
      bucket.rateMinutes > 0 ? bucket.rateSum / bucket.rateMinutes : hourlyRate;
    const amount =
      typeRate != null ? (bucket.minutes / 60) * typeRate : null;
    return {
      workType,
      minutes: bucket.minutes,
      hours: Math.round((bucket.minutes / 60) * 100) / 100,
      amount: amount != null ? Math.round(amount * 100) / 100 : null,
      entryCount: bucket.entries,
    };
  });

  const result: SummaryResult = {
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    hourlyRate,
    totalAmount: totalAmount != null ? Math.round(totalAmount * 100) / 100 : null,
    entryCount: rows.length,
    byWorkType,
    byDay: [...byDayMap.entries()]
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byMonth: [...byMonthMap.entries()]
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };

  return NextResponse.json(result);
}
