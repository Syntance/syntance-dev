import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { userFlows, pages } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { listRelations } from "@/lib/strategy-hub/relations/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id: projectId, elementId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const relatedUserFlows = await db
    .select({ id: userFlows.id, name: userFlows.name })
    .from(userFlows)
    .where(eq(userFlows.entryElementId, elementId));

  const flowIds = relatedUserFlows.map((f) => f.id);
  let relatedPages: { id: string; name: string }[] = [];

  if (flowIds.length > 0) {
    const relations = await listRelations(projectId);
    const pageIds = relations
      .filter(
        (r) =>
          r.relationType === "prowadzi_przez" &&
          r.sourceType === "flow" &&
          r.targetType === "page" &&
          flowIds.includes(r.sourceId)
      )
      .map((r) => r.targetId);

    if (pageIds.length > 0) {
      relatedPages = await db
        .select({ id: pages.id, name: pages.name })
        .from(pages)
        .where(inArray(pages.id, pageIds));
    }
  }

  return NextResponse.json({ userFlows: relatedUserFlows, pages: relatedPages });
}
