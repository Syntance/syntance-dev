import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { offers, segments } from "@/db/schema";
import { requireProjectAccess, badRequest, notFound } from "@/lib/strategy-hub/api-helpers";
import {
  listRelations,
  createRelation,
  softDeleteRelation,
} from "@/lib/strategy-hub/relations/store";

const putSchema = z.object({
  segmentIds: z.array(z.string().uuid()),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const { id: projectId, offerId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const [offer] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.id, offerId), eq(offers.projectId, projectId)))
    .limit(1);

  if (!offer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relations = await listRelations(projectId, {
    entity: { type: "offer", id: offerId },
  });

  const segmentIds = relations
    .filter((r) => r.relationType === "skierowana_do" && r.targetType === "segment")
    .map((r) => r.targetId);

  return NextResponse.json({ segmentIds });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; offerId: string }> }
) {
  const { id: projectId, offerId } = await params;
  const auth = await requireProjectAccess(projectId);
  if (!auth.ok) return auth.response;

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest("Invalid input", parsed.error.flatten());
  }

  const [offer] = await db
    .select({ id: offers.id })
    .from(offers)
    .where(and(eq(offers.id, offerId), eq(offers.projectId, projectId)))
    .limit(1);

  if (!offer) {
    return notFound("Offer");
  }

  if (parsed.data.segmentIds.length > 0) {
    const valid = await db
      .select({ id: segments.id })
      .from(segments)
      .where(
        and(
          eq(segments.projectId, projectId),
          inArray(segments.id, parsed.data.segmentIds)
        )
      );
    if (valid.length !== parsed.data.segmentIds.length) {
      return badRequest("Invalid segment ids");
    }
  }

  const existing = await listRelations(projectId, {
    entity: { type: "offer", id: offerId },
  });
  const current = existing.filter(
    (r) =>
      r.sourceType === "offer" &&
      r.sourceId === offerId &&
      r.relationType === "skierowana_do"
  );

  const desired = new Set(parsed.data.segmentIds);
  for (const rel of current) {
    if (!desired.has(rel.targetId)) {
      await softDeleteRelation(projectId, rel.id, { userId: null });
    }
  }

  const currentTargets = new Set(current.map((r) => r.targetId));
  for (const segmentId of parsed.data.segmentIds) {
    if (!currentTargets.has(segmentId)) {
      await createRelation(
        projectId,
        {
          source: { type: "offer", id: offerId },
          target: { type: "segment", id: segmentId },
          relationType: "skierowana_do",
        },
        { source: "human", userId: null }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
