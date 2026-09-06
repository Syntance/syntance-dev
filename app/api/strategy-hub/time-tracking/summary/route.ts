import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import {
  requireApiAccess,
  badRequest,
  notFound,
  requireProjectAccess,
} from "@/lib/strategy-hub/api-helpers";
import {
  getOrganizationRole,
  listOrganizationsForAdmin,
} from "@/lib/strategy-hub/context";
import {
  computeDurationMinutes,
  isWorkType,
  resolveHourlyRate,
  WORK_TYPES,
  type SummaryResult,
  type WorkType,
  type WorkTypeSummary,
  toDateKey,
  toMonthKey,
} from "@/lib/strategy-hub/time-tracking";
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";

/** Opcjonalne zawężenie podsumowania do jednej organizacji (query param). */
const scopeSchema = z.object({
  organizationId: z.string().uuid().optional(),
});

/**
 * Organizacje, z których admin może liczyć podsumowanie czasu.
 *
 * Admin należy do WIELU organizacji, więc domyślnie sumujemy wpisy ze
 * wszystkich. Jawny `organizationId` zawęża zakres, ale dopiero po sprawdzeniu
 * członkostwa — `null` oznacza organizację spoza jego zasięgu.
 */
async function resolveOrganizationIds(
  email: string,
  organizationId: string | undefined
): Promise<string[] | null> {
  if (organizationId) {
    const role = await getOrganizationRole(email, organizationId);
    return role ? [organizationId] : null;
  }

  const organizacje = await listOrganizationsForAdmin(email);
  return organizacje.map((o) => o.organization.id);
}

function emptyWorkTypeMap(): Record<
  WorkType,
  { minutes: number; entries: number; amount: number; hasRate: boolean }
> {
  return {
    development: { minutes: 0, entries: 0, amount: 0, hasRate: false },
    maintenance: { minutes: 0, entries: 0, amount: 0, hasRate: false },
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

  const scope = scopeSchema.safeParse({
    organizationId: searchParams.get("organizationId") ?? undefined,
  });
  if (!scope.success) {
    return badRequest("Invalid input", scope.error.flatten());
  }

  const organizationIds = await resolveOrganizationIds(
    auth.access.session.email,
    scope.data.organizationId
  );
  if (!organizationIds) return notFound("Organizacja");

  if (projectId) {
    const projectAuth = await requireProjectAccess(projectId);
    if (!projectAuth.ok) return projectAuth.response;
  }

  const conditions = [
    isNull(timeEntries.deletedAt),
    // Admin bez organizacji: `inArray` z pustą tablicą daje `false`,
    // czyli zero wyników — fail-closed, nigdy „wszystko".
    inArray(projects.organizationId, organizationIds),
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
      hourlyRateDevelopment: projects.hourlyRateDevelopment,
      hourlyRateMaintenance: projects.hourlyRateMaintenance,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(...conditions));

  let totalMinutes = 0;
  let totalAmount = 0;
  let hasAnyAmount = false;
  const byDayMap = new Map<string, { minutes: number; entries: number }>();
  const byMonthMap = new Map<string, { minutes: number; entries: number }>();
  const byWorkTypeMap = emptyWorkTypeMap();
  const rateWeighted: Record<
    WorkType,
    { rateSum: number; rateMinutes: number }
  > = {
    development: { rateSum: 0, rateMinutes: 0 },
    maintenance: { rateSum: 0, rateMinutes: 0 },
  };

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

    const rate = resolveHourlyRate(wt, {
      hourlyRateDevelopment: row.hourlyRateDevelopment,
      hourlyRateMaintenance: row.hourlyRateMaintenance,
    });

    if (rate != null && minutes > 0) {
      const entryAmount = (minutes / 60) * rate;
      wtBucket.amount += entryAmount;
      wtBucket.hasRate = true;
      totalAmount += entryAmount;
      hasAnyAmount = true;
      rateWeighted[wt].rateSum += rate * minutes;
      rateWeighted[wt].rateMinutes += minutes;
    }
  }

  let hourlyRates: SummaryResult["hourlyRates"];

  if (projectId && rows[0]) {
    hourlyRates = {
      development: rows[0].hourlyRateDevelopment,
      maintenance: rows[0].hourlyRateMaintenance,
    };
  } else {
    hourlyRates = {
      development:
        rateWeighted.development.rateMinutes > 0
          ? rateWeighted.development.rateSum /
            rateWeighted.development.rateMinutes
          : null,
      maintenance:
        rateWeighted.maintenance.rateMinutes > 0
          ? rateWeighted.maintenance.rateSum /
            rateWeighted.maintenance.rateMinutes
          : null,
    };
  }

  const byWorkType: WorkTypeSummary[] = WORK_TYPES.map((workType) => {
    const bucket = byWorkTypeMap[workType];
    const typeRate =
      projectId && rows[0]
        ? resolveHourlyRate(workType, {
            hourlyRateDevelopment: rows[0].hourlyRateDevelopment,
            hourlyRateMaintenance: rows[0].hourlyRateMaintenance,
          })
        : rateWeighted[workType].rateMinutes > 0
          ? rateWeighted[workType].rateSum / rateWeighted[workType].rateMinutes
          : hourlyRates[workType];

    return {
      workType,
      minutes: bucket.minutes,
      hours: Math.round((bucket.minutes / 60) * 100) / 100,
      hourlyRate: typeRate,
      amount: bucket.hasRate
        ? Math.round(bucket.amount * 100) / 100
        : null,
      entryCount: bucket.entries,
    };
  });

  const result: SummaryResult = {
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    hourlyRates,
    totalAmount: hasAnyAmount ? Math.round(totalAmount * 100) / 100 : null,
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
