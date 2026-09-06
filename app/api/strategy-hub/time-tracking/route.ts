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
  type TimeEntryRow,
} from "@/lib/strategy-hub/time-tracking";
import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";

const workTypeSchema = z.enum(["development", "maintenance"]);

/** Opcjonalne zawężenie listy do jednej organizacji (query param). */
const scopeSchema = z.object({
  organizationId: z.string().uuid().optional(),
});

/**
 * Organizacje, z których admin może oglądać wpisy czasu.
 *
 * Admin należy do WIELU organizacji, więc „moje wpisy" to wpisy ze wszystkich
 * jego organizacji. Jawny `organizationId` zawęża wynik, ale dopiero po
 * sprawdzeniu członkostwa — `null` oznacza organizację spoza jego zasięgu
 * (obsługiwane jak brak zasobu, żeby nie zdradzać cudzych identyfikatorów).
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

export async function GET(req: NextRequest) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const activeOnly = searchParams.get("active") === "true";

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
      hourlyRateDevelopment: projects.hourlyRateDevelopment,
      hourlyRateMaintenance: projects.hourlyRateMaintenance,
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
        hourlyRateDevelopment: r.hourlyRateDevelopment,
        hourlyRateMaintenance: r.hourlyRateMaintenance,
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
          hourlyRateDevelopment: project.hourlyRateDevelopment,
          hourlyRateMaintenance: project.hourlyRateMaintenance,
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
        hourlyRateDevelopment: projects.hourlyRateDevelopment,
        hourlyRateMaintenance: projects.hourlyRateMaintenance,
        organizationId: projects.organizationId,
      })
      .from(timeEntries)
      .innerJoin(projects, eq(timeEntries.projectId, projects.id))
      .where(and(eq(timeEntries.id, entryId), isNull(timeEntries.deletedAt)))
      .limit(1);

    const row = rows[0];
    if (!row) return badRequest("Wpis nie znaleziony.");

    // Wpis musi leżeć w KTÓREJKOLWIEK organizacji admina — członkostwo
    // rozstrzyga wyłącznie `organizationMembers`.
    const role = await getOrganizationRole(email, row.organizationId);
    if (!role) {
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
        hourlyRateDevelopment: row.hourlyRateDevelopment,
        hourlyRateMaintenance: row.hourlyRateMaintenance,
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
        hourlyRateDevelopment: project.hourlyRateDevelopment,
        hourlyRateMaintenance: project.hourlyRateMaintenance,
      }),
    },
    { status: 201 }
  );
}
