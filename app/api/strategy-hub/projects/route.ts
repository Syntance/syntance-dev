import { NextResponse } from "next/server";
import { getStrategyHubAccess, getOrCreateWorkspaceForAdmin } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { and, eq, isNull, desc } from "drizzle-orm";

export async function GET() {
  const access = await getStrategyHubAccess();
  if (!access)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await getOrCreateWorkspaceForAdmin(access.session.email);

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      slug: projects.slug,
      status: projects.status,
      hourlyRate: projects.hourlyRate,
    })
    .from(projects)
    .where(and(isNull(projects.deletedAt), eq(projects.workspaceId, ws.id)))
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json({ projects: rows });
}
