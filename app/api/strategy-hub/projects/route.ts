import { NextResponse } from "next/server";
import { getStrategyHubAccess } from "@/lib/strategy-hub/context";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { isNull, desc } from "drizzle-orm";

export async function GET() {
  const access = await getStrategyHubAccess();
  if (!access)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      icon: projects.icon,
      slug: projects.slug,
      status: projects.status,
    })
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(desc(projects.updatedAt));

  return NextResponse.json({ projects: rows });
}
