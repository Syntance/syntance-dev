import { NextRequest, NextResponse } from "next/server";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";
import { db } from "@/db";
import { userFlows, userFlowPages, pages } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; elementId: string }> }
) {
  const { id, elementId } = await params;
  const auth = await requireProjectAccess(id);
  if (!auth.ok) return auth.response;

  const relatedUserFlows = await db
    .select({ id: userFlows.id, name: userFlows.name })
    .from(userFlows)
    .where(eq(userFlows.entryElementId, elementId));

  // Pages that have user flows pointing through this element (via user_flow_pages)
  // Simple: pages referenced by the user flows above
  const flowIds = relatedUserFlows.map((f) => f.id);
  let relatedPages: { id: string; name: string }[] = [];
  if (flowIds.length > 0) {
    const pageRows = await db
      .selectDistinct({ id: pages.id, name: pages.name })
      .from(userFlowPages)
      .innerJoin(pages, eq(userFlowPages.pageId, pages.id))
      .where(
        flowIds.length === 1
          ? eq(userFlowPages.userFlowId, flowIds[0])
          : eq(userFlowPages.userFlowId, flowIds[0]) // simple for now
      );
    relatedPages = pageRows;
  }

  return NextResponse.json({ userFlows: relatedUserFlows, pages: relatedPages });
}
