import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, timeEntries } from "@/db/schema";
import {
  requireApiAccess,
  badRequest,
  requireProjectAccess,
} from "@/lib/strategy-hub/api-helpers";
import { getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";
import {
  computeDurationMinutes,
  isWorkType,
  type TimeEntryRow,
} from "@/lib/strategy-hub/time-tracking";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";

const workTypeSchema = z.enum(["development", "maintenance"]);

const createSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    projectId: z.string().uuid(),
    workType: workTypeSchema.default("development"),
    comment: z.string().max(5000).optional(),
  }),
  z.object({
    action: z.literal("stop"),
    entryId: z.string().uuid().optional(),
    comment: z.string().max(5000).optional(),
  }),
  z.object({
    action: z.literal("manual"),
    projectId: z.string().uuid(),
    workType: workTypeSchema.default("development"),
    startedAt: z.string().datetime(),
    endedAt: z.string().datetime(),
    comment: z.string().max(5000).optional(),
  }),
]);

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

export async function GET(req: NextRequest) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const activeOnly = searchParams.get("active") === "true";

  const ws = await getOrCreateWorkspaceForAdmin(auth.access.session.email);

  if (projectId) {
    const projectAuth = await requireProjectAccess(projectId);
    if (!projectAuth.ok) return projectAuth.response;
  }

  const conditions = [
    isNull(timeEntries.deletedAt),
    eq(projects.workspaceId, ws.id),
  ];

  if (projectId) {
    conditions.push(eq(timeEntries.projectId, projectId));
  }

  if (from) {
    conditions.push(gte(timeEntries.startedAt, new Date(from)));
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(timeEntries.startedAt, toDate));
  }

  if (activeOnly) {
    conditions.push(isNull(timeEntries.endedAt));
    conditions.push(eq(timeEntries.userEmail, auth.access.session.email));
  }

  const rows = await db
    .select({
      entry: timeEntries,
      projectName: projects.name,
      projectIcon: projects.icon,
      hourlyRate: projects.hourlyRate,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(timeEntries.projectId, projects.id))
    .where(and(...conditions))
    .orderBy(desc(timeEntries.startedAt));

  return NextResponse.json({
    entries: rows.map((r) =>
      mapEntry({
        ...r.entry,
        projectName: r.projectName,
        projectIcon: r.projectIcon,
        hourlyRate: r.hourlyRate,
      })
    ),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const email = auth.access.session.email;
  const now = new Date();

  if (parsed.data.action === "start") {
    const projectAuth = await requireProjectAccess(parsed.data.projectId);
    if (!projectAuth.ok) return projectAuth.response;

    const active = await db
      .select({ id: timeEntries.id })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userEmail, email),
          isNull(timeEntries.endedAt),
          isNull(timeEntries.deletedAt)
        )
      )
      .limit(1);

    if (active[0]) {
      return badRequest("Masz już aktywny timer. Zatrzymaj go przed startem nowego.");
    }

    const [entry] = await db
      .insert(timeEntries)
      .values({
        projectId: parsed.data.projectId,
        userEmail: email,
        workType: parsed.data.workType,
        comment: parsed.data.comment ?? null,
        startedAt: now,
      })
      .returning();

    const project = projectAuth.project;
    return NextResponse.json(
      {
        entry: mapEntry({
          ...entry,
          projectName: project.name,
          projectIcon: project.icon,
          hourlyRate: project.hourlyRate,
        }),
      },
      { status: 201 }
    );
  }

  if (parsed.data.action === "stop") {
    let entryId = parsed.data.entryId;

    if (!entryId) {
      const active = await db
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(
          and(
            eq(timeEntries.userEmail, email),
            isNull(timeEntries.endedAt),
            isNull(timeEntries.deletedAt)
          )
        )
        .limit(1);
      entryId = active[0]?.id;
    }

    if (!entryId) {
      return badRequest("Brak aktywnego timera do zatrzymania.");
    }

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
    if (!row) return badRequest("Wpis nie znaleziony.");

    const ws = await getOrCreateWorkspaceForAdmin(email);
    if (row.workspaceId !== ws.id) {
      return badRequest("Brak dostępu do tego wpisu.");
    }

    if (row.entry.endedAt) {
      return badRequest("Ten wpis jest już zakończony.");
    }

    const durationMinutes = computeDurationMinutes(row.entry.startedAt, now);
    const comment =
      parsed.data.comment !== undefined
        ? parsed.data.comment
        : row.entry.comment;

    const [updated] = await db
      .update(timeEntries)
      .set({
        endedAt: now,
        durationMinutes,
        comment,
        updatedAt: now,
      })
      .where(eq(timeEntries.id, entryId))
      .returning();

    return NextResponse.json({
      entry: mapEntry({
        ...updated,
        projectName: row.projectName,
        projectIcon: row.projectIcon,
        hourlyRate: row.hourlyRate,
      }),
    });
  }

  const projectAuth = await requireProjectAccess(parsed.data.projectId);
  if (!projectAuth.ok) return projectAuth.response;

  const startedAt = new Date(parsed.data.startedAt);
  const endedAt = new Date(parsed.data.endedAt);

  if (endedAt <= startedAt) {
    return badRequest("Godzina zakończenia musi być późniejsza niż rozpoczęcia.");
  }

  const durationMinutes = computeDurationMinutes(startedAt, endedAt);

  const [entry] = await db
    .insert(timeEntries)
    .values({
      projectId: parsed.data.projectId,
      userEmail: email,
      workType: parsed.data.workType,
      comment: parsed.data.comment ?? null,
      startedAt,
      endedAt,
      durationMinutes,
    })
    .returning();

  const project = projectAuth.project;
  return NextResponse.json(
    {
      entry: mapEntry({
        ...entry,
        projectName: project.name,
        projectIcon: project.icon,
        hourlyRate: project.hourlyRate,
      }),
    },
    { status: 201 }
  );
}
