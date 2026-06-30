import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import { offers, offerSegments, segments } from "@/db/schema";
import { requireProjectAccess, badRequest } from "@/lib/strategy-hub/api-helpers";

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

  const rows = await db
    .select({ segmentId: offerSegments.segmentId })
    .from(offerSegments)
    .where(eq(offerSegments.offerId, offerId));

  return NextResponse.json({ segmentIds: rows.map((r) => r.segmentId) });
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
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Walidacja segmentów należących do projektu
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

  await db.transaction(async (tx) => {
    await tx.delete(offerSegments).where(eq(offerSegments.offerId, offerId));
    if (parsed.data.segmentIds.length > 0) {
      await tx.insert(offerSegments).values(
        parsed.data.segmentIds.map((segmentId) => ({ offerId, segmentId }))
      );
    }
  });

  return NextResponse.json({ ok: true });
}
