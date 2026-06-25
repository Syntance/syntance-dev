import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import {
  requireApiAccess,
  badRequest,
  notFound,
} from "@/lib/strategy-hub/api-helpers";
import { getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";
import {
  computeDurationMinutes,
  isWorkType,
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
    hourlyRate: number | null;
  }
): TimeEntryRow {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.projectName,
    projectIcon: row.projectIcon,
    userEmail: row.userEmail,
    comment: row.comment,
    workType: isWorkType(row.workType) ? row.workType : "development",
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    durationMinutes: row.durationMinutes,
    hourlyRate: row.hourlyRate,
  };
}

async function getEntryForUser(entryId: string, email: string) {
  const ws = await getOrCreateWorkspaceForAdmin(email);
  const rows = await db
    .select({
      entry: timeEntries,
      projectName: projects.name,
      projectIcon: projects.icon,
      hourlyRate: projects.hourlyRate,
      workspaceId: projects.workspaceId,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(eq(timeEntries.id, entryId), isNull(timeEntries.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row || row.workspaceId !== ws.id) return null;
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

  let projectName = row.projectName;
  let projectIcon = row.projectIcon;
  let hourlyRate = row.hourlyRate;

  if (parsed.data.projectId && parsed.data.projectId !== row.entry.projectId) {
    const projectRows = await db
      .select({
        name: projects.name,
        icon: projects.icon,
        hourlyRate: projects.hourlyRate,
        workspaceId: projects.workspaceId,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, parsed.data.projectId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    const project = projectRows[0];
    const ws = await getOrCreateWorkspaceForAdmin(auth.access.session.email);
    if (!project || project.workspaceId !== ws.id) {
      return badRequest("Nieprawidłowy projekt.");
    }
    projectName = project.name;
    projectIcon = project.icon;
    hourlyRate = project.hourlyRate;
  }

  return NextResponse.json({
    entry: mapEntry({
      ...updated,
      projectName,
      projectIcon,
      hourlyRate,
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
