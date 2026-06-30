import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { strategicDecisions, decisionLinks } from "@/db/schema";
import { requireProjectAccess } from "@/lib/strategy-hub/api-helpers";

/** Decyzje powiązane z encją + łańcuch cause/effect (overlay „dlaczego tak?"). */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const entityType = new URL(req.url).searchParams.get("entityType");
  const entityId = new URL(req.url).searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId required" },
      { status: 400 }
    );
  }

  const matchingLinks = await db
    .select({ decisionId: decisionLinks.decisionId })
    .from(decisionLinks)
    .innerJoin(
      strategicDecisions,
      eq(decisionLinks.decisionId, strategicDecisions.id)
    )
    .where(
      and(
        eq(strategicDecisions.projectId, projectId),
        eq(decisionLinks.entityType, entityType),
        eq(decisionLinks.entityId, entityId)
      )
    );

  const decisionIds = [...new Set(matchingLinks.map((r) => r.decisionId))];
  if (decisionIds.length === 0) {
    return NextResponse.json({ decisions: [], links: [], chain: [] });
  }

  const [decisions, allLinks] = await Promise.all([
    db
      .select()
      .from(strategicDecisions)
      .where(
        and(
          eq(strategicDecisions.projectId, projectId),
          inArray(strategicDecisions.id, decisionIds)
        )
      ),
    db
      .select()
      .from(decisionLinks)
      .where(inArray(decisionLinks.decisionId, decisionIds)),
  ]);

  return NextResponse.json({
    decisions,
    links: allLinks,
    chain: allLinks.map((l) => ({
      decisionId: l.decisionId,
      entityType: l.entityType,
      entityId: l.entityId,
      role: l.role,
    })),
  });
}
