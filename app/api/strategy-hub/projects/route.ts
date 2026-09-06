import { NextResponse } from "next/server";
import { getCurrentOrganizationForAdmin } from "@/lib/strategy-hub/context";
import { requireApiAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireApiAccess();
  if (!auth.ok) return auth.response;

  // Granica tenanta: lista jest zawężona do BIEŻĄCEJ organizacji admina
  // (jawny wybór z ciasteczka `sh_org`), nie do „wszystkich, których jest
  // właścicielem" — jeden admin należy dziś do wielu organizacji.
  const organization = await getCurrentOrganizationForAdmin(
    auth.access.session.email
  );

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      slug: projects.slug,
      status: projects.status,
      kind: projects.kind,
      hourlyRateDevelopment: projects.hourlyRateDevelopment,
      hourlyRateMaintenance: projects.hourlyRateMaintenance,
    })
    .from(projects)
    .where(
      and(
        isNull(projects.deletedAt),
        eq(projects.organizationId, organization.id)
      )
    )
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json({ projects: rows });
}
