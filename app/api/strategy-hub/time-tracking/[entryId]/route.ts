import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import {
  getOrganizationRole,
  getProjectForAdmin,
} from "@/lib/strategy-hub/context";
import {
  computeDurationMinutes,
  isWorkType,
  resolveHourlyRate,
  type TimeEntryRow,
} from "@/lib/strategy-hub/time-tracking";
import { and, eq, isNull } from "drizzle-orm";

const patchSchema = z.object({
  projectId: z.string().uuid().optional(),
  workType: z.enum(["development", "maintenance"]).optional(),
  comment: z.string().max(5000).nullable().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
});

function mapEntry(
  row: typeof timeEntries.$inferSelect & {
    projectName: string;
    projectIcon: string | null;
    hourlyRateDevelopment: number | null;
    hourlyRateMaintenance: number | null;
  }
): TimeEntryRow {
  const workType = isWorkType(row.workType) ? row.workType : "development";
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    projectIcon: row.projectIcon,
    userEmail: row.userEmail,
    comment: row.comment,
    workType,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    hourlyRate: resolveHourlyRate(workType, {
      hourlyRateDevelopment: row.hourlyRateDevelopment,
      hourlyRateMaintenance: row.hourlyRateMaintenance,
    }),
  };
}

/**
 * Wpis widoczny dla admina: projekt wpisu musi należeć do KTÓREJKOLWIEK
 * organizacji, w której admin ma członkostwo (`organizationMembers`).
 * `null` = brak wpisu albo brak dostępu — celowo nie rozróżniamy.
 */
async function getEntryForUser(entryId: string, email: string) {
  const rows = await db
    .select({
      entry: timeEntries,
      projectName: projects.name,
      projectIcon: projects.icon,
      hourlyRateDevelopment: projects.hourlyRateDevelopment,
      hourlyRateMaintenance: projects.hourlyRateMaintenance,
      organizationId: projects.organizationId,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(eq(timeEntries.id, entryId), isNull(timeEntries.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const role = await getOrganizationRole(email, row.organizationId);
  if (!role) return null;

  return row;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const { entryId } = await params;
  const row = await getEntryForUser(entryId, auth.access.session.email);
  if (!row) return notFound("Wpis");

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const startedAt = parsed.data.startedAt
    ? new Date(parsed.data.startedAt)
    : row.entry.startedAt;
  const endedAt =
    parsed.data.endedAt !== undefined
      ? parsed.data.endedAt
        ? new Date(parsed.data.endedAt)
        : null
      : row.entry.endedAt;

  if (endedAt && endedAt <= startedAt) {
    return badRequest("Godzina zakończenia musi być późniejsza niż rozpoczęcia.");
  }

  let durationMinutes = row.entry.durationMinutes;
  if (endedAt) {
    durationMinutes = computeDurationMinutes(startedAt, endedAt);
  } else if (parsed.data.endedAt === null) {
    durationMinutes = null;
  }

  let projectName = row.projectName;
  let projectIcon = row.projectIcon;
  let hourlyRateDevelopment = row.hourlyRateDevelopment;
  let hourlyRateMaintenance = row.hourlyRateMaintenance;

  // Przeniesienie wpisu do innego projektu walidujemy PRZED zapisem — projekt
  // docelowy musi leżeć w organizacji admina, inaczej wpis wyciekłby do cudzego
  // tenanta mimo zwróconego 400.
  if (parsed.data.projectId && parsed.data.projectId !== row.entry.projectId) {
    const project = await getProjectForAdmin(
      parsed.data.projectId,
      auth.access.session.email
    );
    if (!project) {
      return badRequest("Nieprawidłowy projekt.");
    }
    projectName = project.name;
    projectIcon = project.icon;
    hourlyRateDevelopment = project.hourlyRateDevelopment;
    hourlyRateMaintenance = project.hourlyRateMaintenance;
  }

  const [updated] = await db
    .update(timeEntries)
    .set({
      projectId: parsed.data.projectId ?? row.entry.projectId,
      workType: parsed.data.workType ?? row.entry.workType,
      comment:
        parsed.data.comment !== undefined
          ? parsed.data.comment
          : row.entry.comment,
      startedAt,
      endedAt,
      durationMinutes,
      updatedAt: new Date(),
    })
    .where(eq(timeEntries.id, entryId))
    .returning();

  return NextResponse.json({
    entry: mapEntry({
      ...updated,
      projectName,
      projectIcon,
      hourlyRateDevelopment,
      hourlyRateMaintenance,
    }),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const { entryId } = await params;
  const row = await getEntryForUser(entryId, auth.access.session.email);
  if (!row) return notFound("Wpis");

  await db
    .update(timeEntries)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(timeEntries.id, entryId));

  return NextResponse.json({ success: true });
}
