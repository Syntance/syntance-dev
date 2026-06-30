import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { changeHistory } from "@/db/schema";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  const filters = [eq(changeHistory.projectId, projectId)];
  if (entityType) filters.push(eq(changeHistory.entityType, entityType));
  if (entityId) filters.push(eq(changeHistory.entityId, entityId));

  const items = await db
    .select()
    .from(changeHistory)
    .where(and(...filters))
    .orderBy(desc(changeHistory.createdAt))
    .limit(limit);

  return NextResponse.json({ items });
}
