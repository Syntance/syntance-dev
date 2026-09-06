import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, count, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { projects } from "@/db/schema";
import {
  createOrganizationForAdmin,
  getCurrentOrganizationForAdmin,
  listOrganizationsForAdmin,
} from "@/lib/strategy-hub/context";
import { requireApiAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

const createSchema = z.object({
  name: z.string().min(1).max(255),
});

/**
 * Organizacje, do których zalogowany admin ma dostęp (członkostwo), wraz
 * z liczbą projektów i wskazaniem bieżącej. `activeOrganizationId` musi
 * przyjść z serwera — ciasteczko wyboru jest httpOnly, więc klient go nie
 * odczyta.
 */
export async function GET() {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const email = auth.access.session.email;
  const rows = await listOrganizationsForAdmin(email);

  const ids = rows.map((r) => r.organization.id);
  const liczniki = new Map<string, number>();
  if (ids.length > 0) {
    const counts = await db
      .select({ organizationId: projects.organizationId, n: count() })
      .from(projects)
      .where(
        and(inArray(projects.organizationId, ids), isNull(projects.deletedAt))
      )
      .groupBy(projects.organizationId);
    for (const c of counts) liczniki.set(c.organizationId, Number(c.n));
  }

  const active = await getCurrentOrganizationForAdmin(email);

  return NextResponse.json({
    activeOrganizationId: active.id,
    organizations: rows.map(({ organization, role }) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      logoFileId: organization.logoFileId,
      status: organization.status,
      role,
      projectCount: liczniki.get(organization.id) ?? 0,
    })),
  });
}

/** Nowa organizacja — twórca zostaje jej właścicielem. */
export async function POST(req: NextRequest) {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());

  const organization = await createOrganizationForAdmin(
    auth.access.session.email,
    parsed.data.name.trim()
  );

  return NextResponse.json({ organization }, { status: 201 });
}
